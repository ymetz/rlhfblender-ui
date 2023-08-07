// React
import React, {SyntheticEvent, createRef} from 'react';

// Our components
import ConfigModal from './components/config-modal';
import ExperimentStartModal from './components/experiment-start-modal';
import Menu from './components/menu';

// Drag and drop
import {DropResult} from 'react-beautiful-dnd';

// Material UI
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import {SelectChangeEvent} from '@mui/material/Select';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';

// Material UI Icons
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

// Default UI Config
import defaultUIConfig from './default_ui_config';

// Axios
import axios from 'axios';

// Types
import {AppProps, AppState, Episode, SetupConfig, Feedback} from './types';

// Utils
import {IDfromEpisode, EpisodeFromID} from './id';
import initialEpisodes from './initial-data';
import FeedbackInterface from './components/feedback-interface';

class App extends React.Component<AppProps, AppState> {
  private scrollableListContainerRef = createRef<HTMLDivElement>();
  constructor(props: AppProps) {
    super(props);
    this.state = {
      videoURLCache: {},
      rewardsCache: {},
      thumbnailURLCache: {},
      status_bar_collapsed: false,
      projects: [],
      experiments: [],
      filtered_experiments: [],
      activeEpisodes: [],
      highlightedEpisodes: [],
      selectedProject: {id: -1, project_name: '', project_experiments: []},
      selectedExperiment: {id: -1, exp_name: ''},
      sliderValue: 0,
      modalOpen: false,
      startModalOpen: false,
      sessionId: '-',
      // Drag and drop
      rankeableEpisodeIDs: [
        IDfromEpisode(initialEpisodes[0]),
        IDfromEpisode(initialEpisodes[1]),
        IDfromEpisode(initialEpisodes[2]),
        IDfromEpisode(initialEpisodes[3]),
        IDfromEpisode(initialEpisodes[4]),
      ],

      ranks: {
        'rank-1': {
          rank: 1,
          title: 'Rank 1',
          episodeItemIDs: [IDfromEpisode(initialEpisodes[0])],
        },
        'rank-2': {
          rank: 2,
          title: 'Rank 2',
          episodeItemIDs: [IDfromEpisode(initialEpisodes[1])],
        },
        'rank-3': {
          rank: 3,
          title: 'Rank 3',
          episodeItemIDs: [IDfromEpisode(initialEpisodes[2])],
        },
        'rank-4': {
          rank: 4,
          title: 'Rank 4',
          episodeItemIDs: [IDfromEpisode(initialEpisodes[3])],
        },
        'rank-5': {
          rank: 5,
          title: 'Rank 5',
          episodeItemIDs: [IDfromEpisode(initialEpisodes[4])],
        },
      },
      // Facilitate reordering of the columns
      columnOrder: ['rank-1', 'rank-2', 'rank-3', 'rank-4', 'rank-5'],
      episodeIDsChronologically: [],
      allSetupConfigs: [],
      activeSetupConfig: defaultUIConfig,
      scheduledFeedback: [],
      currentStep: 0,
      startModalContent: null,
    };
  }

  componentDidMount() {
    axios.get('/get_all?model_name=project').then(res => {
      this.setState({projects: res.data});
    });

    axios.get('/get_all?model_name=experiment').then(res => {
      this.setState({experiments: res.data});
    });

    axios.get('/ui_configs').then(res => {
      this.setState({allSetupConfigs: res.data});
    });

    //this.getEpisodeIDsChronologically();
  }

  toggleStatusBar() {
    this.setState({status_bar_collapsed: !this.state.status_bar_collapsed});
  }

  selectProject(event: SelectChangeEvent) {
    const selectedProject =
      this.state.projects.find(
        project => project.id === Number.parseInt(event.target.value)
      ) || this.state.selectedProject;
    const project_experiments =
      selectedProject?.project_experiments.map(e =>
        e.trim().replace(',', '')
      ) || [];
    const filtered_experiments = this.state.experiments.filter(experiment =>
      project_experiments.includes(experiment.exp_name)
    );
    console.log(filtered_experiments);
    this.setState({
      selectedProject: selectedProject,
      filtered_experiments: filtered_experiments,
    });
  }

  selectExperiment(event: SelectChangeEvent) {
    const selectedExperiment =
      this.state.experiments.find(
        experiment => experiment.id === Number.parseInt(event.target.value)
      ) || this.state.selectedExperiment;
    this.setState({selectedExperiment});
  }

  selectSetupConfig(event: SelectChangeEvent) {
    const selectedSetupConfig =
      this.state.allSetupConfigs.find(
        SetupConfig => SetupConfig.id === Number.parseInt(event.target.value)
      ) || this.state.activeSetupConfig;
    this.setState({activeSetupConfig: selectedSetupConfig});
  }

  createCustomConfig = () => this.setState({modalOpen: true});

  closeConfigModal = (new_config: SetupConfig) => {
    if (new_config === null) {
      this.setState({modalOpen: false});
      return;
    }
    const last_id = this.state.allSetupConfigs.reduce(
      (max, config) => Math.max(max, config.id),
      0
    );
    new_config.id = last_id + 1;

    this.setState(
      {
        modalOpen: false,
        activeSetupConfig: new_config,
        allSetupConfigs: [...this.state.allSetupConfigs, new_config],
      },
      () =>
        axios.post('/save_ui_config', new_config).then(res => {
          console.log(res);
        })
    );
  };

  /* Gets a list of identifiers of episodes in chronological order. */
  getEpisodeIDsChronologically(optionalCallback?: () => void) {
    axios.get('/data/get_all_episodes').then(response => {
      this.setState(
        {episodeIDsChronologically: response.data},
        optionalCallback
      );
    });
  }

  resetSampler() {
    if (this.state.selectedExperiment.id === -1) {
      return;
    }
    axios
      .post(
        '/data/reset_sampler?experiment_id=' +
          this.state.selectedExperiment.id +
          '&sampling_strategy=' +
          this.state.activeSetupConfig.samplingStrategy
      )
      .then(res => {
        this.setState(
          {
            sessionId: res.data.session_id,
            startModalOpen: true,
            currentStep: 0,
          },
          () =>
            this.getEpisodeIDsChronologically(this.sampleEpisodes.bind(this))
        );
      });
  }

  closeStartModal() {
    this.setState({startModalOpen: false});
  }

  scheduleFeedback(feedback: Feedback) {
    this.setState({
      scheduledFeedback: [...this.state.scheduledFeedback, feedback],
    });
  }

  submitFeedback() {
    if (this.state.sessionId === '-') {
      return;
    }

    // Send Submit Signal to the Server
    axios({
      method: 'post',
      url: 'data/submit_current_feedback?session_id=' + this.state.sessionId,
    });
    this.sampleEpisodes();
  }

  async sampleEpisodes() {
    // Call sample_episodes and then put the returned episodes into the activeEpisodeIDs
    if (this.state.selectedExperiment.id === -1) {
      return;
    }
    await axios({
      method: 'get',
      params: {num_episodes: this.state.activeSetupConfig.max_ranking_elements},
      url: '/data/sample_episodes',
    }).then(res => {
      const episodeIDs = res.data.map((e: Episode) => IDfromEpisode(e));

      const new_ranks = Object.fromEntries(
        Array.from({length: 5}, (_, i) => [
          `rank-${i}`,
          {
            rank: i + 1,
            title: `Rank ${i + 1}`,
            episodeItemIDs: [episodeIDs[i]],
          },
        ])
      );
      const old_current_step = this.state.currentStep;
      this.setState({
        ...this.state,
        activeEpisodes: res.data,
        rankeableEpisodeIDs: res.data.map((e: Episode) => IDfromEpisode(e)),
        ranks: new_ranks,
        columnOrder: Object.entries(new_ranks).map(([key]) => key),
        currentStep: old_current_step + 1,
      });
    });
  }

  scrollbarHandler(_: Event | SyntheticEvent, value: number | number[]) {
    this.setState({sliderValue: value as number});
  }

  // Create onDragEnd function
  onDragEnd = (dropResult: DropResult) => {
    const {destination, source, draggableId} = dropResult;

    // If there is no destination, return
    if (!destination) {
      return;
    }

    // If the destination is the same as the source, return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const destDroppableId = destination.droppableId;
    const destDroppable = this.state.ranks[destDroppableId];

    const srcDroppableId = source.droppableId;
    const srcDroppable = this.state.ranks[srcDroppableId];

    let newState: AppState;

    const newRankeableEpisodeIDs = Array.from(this.state.rankeableEpisodeIDs);
    if (srcDroppableId === 'scrollable-episode-list') {
      // This is a new episode, so we need to add it to rankeableEpisodeIDs.
      newRankeableEpisodeIDs.push(draggableId);
    }

    if (
      srcDroppable === destDroppable ||
      srcDroppableId === 'scrollable-episode-list'
    ) {
      // We have the same source and destination, so we are reording within
      // the same rank.
      const newEpisodeItemIDs = Array.from(destDroppable.episodeItemIDs);
      newEpisodeItemIDs.splice(source.index, 1);
      newEpisodeItemIDs.splice(destination.index, 0, draggableId);

      const newRank = {
        ...destDroppable,
        episodeItemIDs: newEpisodeItemIDs,
      };

      newState = {
        ...this.state,
        rankeableEpisodeIDs: newRankeableEpisodeIDs,
        ranks: {
          ...this.state.ranks,
          [destDroppableId]: newRank,
        },
      };
    } else {
      // We are moving an episode from one rank to another.

      // Inserting episode into destination rank.
      const newDestDraggableIDs = Array.from(destDroppable.episodeItemIDs);
      newDestDraggableIDs.splice(destination.index, 0, draggableId);

      // Removing episode from source rank.
      const newSrcDraggableIDs = Array.from(srcDroppable.episodeItemIDs);
      newSrcDraggableIDs.splice(source.index, 1);

      const newDestRank = {
        ...destDroppable,
        episodeItemIDs: newDestDraggableIDs,
      };

      const newSrcRank = {
        ...srcDroppable,
        episodeItemIDs: newSrcDraggableIDs,
      };

      newState = {
        ...this.state,
        ranks: {
          ...this.state.ranks,
          [destDroppableId]: newDestRank,
          [srcDroppableId]: newSrcRank,
        },
      };
    }

    this.setState(newState);
  };

  getThumbnailURL = async (episodeId: string) => {
    if (this.state.thumbnailURLCache[episodeId]) {
      return this.state.thumbnailURLCache[episodeId];
    } else {
      await axios({
        method: 'get',
        url: 'data/get_thumbnail',
        params: EpisodeFromID(episodeId),
        responseType: 'blob',
      })
        .then(response => {
          const url = URL.createObjectURL(response.data);
          const newThumbnailURLCache = this.state.thumbnailURLCache;
          newThumbnailURLCache[episodeId] = url;
          this.setState({
            ...this.state,
            thumbnailURLCache: newThumbnailURLCache,
          });
          return url;
        })
        .catch(error => {
          console.log(error);
        });
    }
  };

  getVideoURL = async (episodeId: string) => {
    if (this.state.videoURLCache[episodeId]) {
      return this.state.videoURLCache[episodeId];
    } else {
      await axios({
        method: 'get',
        url: 'data/get_video',
        params: EpisodeFromID(episodeId),
        responseType: 'blob',
      }).then(response => {
        const url = URL.createObjectURL(response.data);
        const newVideoURLCache = this.state.videoURLCache;
        newVideoURLCache[episodeId] = url;
        this.setState({
          ...this.state,
          videoURLCache: newVideoURLCache,
        });
        return url;
      });
    }
  };

  getRewards = async (episodeId: string) => {
    if (this.state.rewardsCache[episodeId]) {
      return this.state.rewardsCache[episodeId];
    } else {
      await axios({
        method: 'get',
        url: 'data/get_rewards',
        params: EpisodeFromID(episodeId),
      }).then(response => {
        const newRewardsCache = this.state.rewardsCache;
        newRewardsCache[episodeId] = Array.from(
          new Float32Array(response.data)
        );
        this.setState({
          ...this.state,
          rewardsCache: newRewardsCache,
        });
        return newRewardsCache[episodeId];
      });
    }
  };

  render() {
    return (
      <Box
        id="app"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          width: '100vw',
          maxHeight: '100vh',
          maxWidth: '100vw',
          boxSizing: 'border-box',
        }}
      >
        <Box
          id="menu"
          sx={{
            flexDirection: 'column',
            bgcolor: 'background.default',
            boxShadow: '0px 0px 20px 0px rgba(0, 0, 0, 0.2)',
          }}
        >
          <Menu
            statusBarCollapsed={this.state.status_bar_collapsed}
            selectedProjectId={this.state.selectedProject.id.toString()}
            selectProject={this.selectProject.bind(this)}
            projects={this.state.projects}
            selectedExperimentId={this.state.selectedExperiment.id.toString()}
            selectExperiment={this.selectExperiment.bind(this)}
            experiments={this.state.filtered_experiments}
            activeSetupConfigId={this.state.activeSetupConfig.id.toString()}
            selectSetupConfig={this.selectSetupConfig.bind(this)}
            allSetupConfigs={this.state.allSetupConfigs}
            createCustomConfig={this.createCustomConfig.bind(this)}
            resetSampler={this.resetSampler.bind(this)}
            sessionId={this.state.sessionId}
          />
          <Box sx={{display: 'flex', flexDirection: 'row'}}>
            <IconButton
              onClick={() =>
                this.setState({
                  status_bar_collapsed: !this.state.status_bar_collapsed,
                })
              }
            >
              {this.state.status_bar_collapsed ? (
                <ExpandMoreIcon />
              ) : (
                <ExpandLessIcon />
              )}
            </IconButton>
            <Chip
              label={
                this.state.sessionId !== '-'
                  ? 'Status: Active'
                  : 'Status: Waiting'
              }
              color={this.state.sessionId !== '-' ? 'success' : 'info'}
              sx={{marginRight: '2vw', marginTop: '0.2vh', float: 'right'}}
            />
            {this.state.status_bar_collapsed && (
              <Typography
                sx={{
                  width: '45vw',
                  fontWeight: 'bold',
                  margin: 'auto',
                  marginTop: '0.6vh',
                  float: 'right',
                }}
              >
                RLHF-Blender v0.1
              </Typography>
            )}
          </Box>
        </Box>
        {this.state.selectedProject.id >= 0 ? (
          <FeedbackInterface
            onDragEnd={this.onDragEnd.bind(this)}
            currentProgressBarStep={this.state.currentStep}
            episodeIDsChronologically={this.state.episodeIDsChronologically}
            activeSetupConfig={this.state.activeSetupConfig}
            scrollbarHandler={this.scrollbarHandler.bind(this)}
            sliderValue={this.state.sliderValue}
            parentWidthPx={this.scrollableListContainerRef.current?.clientWidth}
            rankeableEpisodeIDs={this.state.rankeableEpisodeIDs}
            columnOrder={this.state.columnOrder}
            ranks={this.state.ranks}
            scheduleFeedback={this.scheduleFeedback.bind(this)}
            getVideo={this.getVideoURL.bind(this)}
            getRewards={this.getRewards.bind(this)}
            getThumbnail={this.getThumbnailURL.bind(this)}
            submitFeedback={this.submitFeedback.bind(this)}
          />
        ) : null}
        <ConfigModal
          config={this.state.activeSetupConfig}
          open={this.state.modalOpen}
          onClose={this.closeConfigModal.bind(this)}
        />
        <ExperimentStartModal
          feedbackComponents={this.state.activeSetupConfig.feedbackComponents}
          content={this.state.startModalContent}
          open={this.state.startModalOpen}
          onClose={this.closeStartModal.bind(this)}
        />
      </Box>
    );
  }
}

export default App;
