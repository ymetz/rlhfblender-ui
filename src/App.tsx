// React
import React, {createRef} from 'react';

// Our components
import ConfigModal from './components/modals/config-modal';
import ExperimentStartModal from './components/modals/experiment-start-modal';
import ExperimentEndModal from './components/modals/experiment-end-modal';
import Menu from './components/menubar/menu';

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

import {defaultUIConfig, defaultBackendConfig} from './default-setup-configs';

// Axios
import axios from 'axios';

// Types
import {
  AppProps,
  AppState,
  AppMode,
  Episode,
  UIConfig,
  BackendConfig,
  Feedback,
  FeedbackType
} from './types';

// Utils
import FeedbackInterface from './components/feedback-interface';

// User Tracking Library
// Contexts
import {UIConfigContext} from './setup-ui-context';
import {GetterContext} from './getter-context';

// Style
import {ThemeProvider} from '@mui/material/styles';
import getDesignTokens from './theme';
import {createTheme} from '@mui/material/styles';
import {Button, PaletteMode} from '@mui/material';
import {EpisodeFromID, IDfromEpisode} from './id';

class App extends React.Component<AppProps, AppState> {
  private scrollableListContainerRef = createRef<HTMLDivElement>();
  constructor(props: AppProps) {
    super(props);
    this.state = {
      app_mode: 'study',
      videoURLCache: {},
      rewardsCache: {},
      uncertaintyCache: {},
      thumbnailURLCache: {},
      status_bar_collapsed: true,
      projects: [],
      experiments: [],
      filtered_experiments: [],
      activeEnvId: '',
      actionLabels: [],
      activeEpisodes: [],
      highlightedEpisodes: [],
      selectedProject: {id: -1, project_name: '', project_experiments: []},
      selectedExperiment: {id: -1, exp_name: ''},
      sliderValue: 0,
      uiConfigModalOpen: false,
      backendConfigModalOpen: false,
      startModalOpen: true,
      endModalOpen: false,
      rankeableEpisodeIDs: [],
      sessionId: '-',
      episodeIDsChronologically: [],
      allUIConfigs: [],
      allBackendConfigs: [],
      activeUIConfig: defaultUIConfig,
      activeBackendConfig: defaultBackendConfig,
      scheduledFeedback: [],
      currentStep: 0,
      startModalContent: undefined,
      allThemes: ['light', 'dark'],
      theme: 'dark',
      isOnSubmit: false,
    };
  }

  componentDidMount() {
    
    const url = new URL(window.location.href);
    console.log(url, url.pathname);
     // we can switch to 'configure' for the configuration mode, but study is default
    const studyMode = url.searchParams.get('studyMode') || 'study';
    if (studyMode === 'configure') {
      this.setState({app_mode: 'configure', status_bar_collapsed: false, startModalOpen: true});
    }

    axios.get('/get_all?model_name=project').then(res => {
      this.setState({projects: res.data});
    });

    axios.get('/get_all?model_name=experiment').then(res => {
      this.setState({experiments: res.data});
    });

    axios.get('/ui_configs').then(res => {
      console.log(res.data);
      this.setState({allUIConfigs: res.data});
    });

    axios.get('/backend_configs').then(res => {
      this.setState({allBackendConfigs: res.data});
    });
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

  selectUIConfig(event: SelectChangeEvent) {
    const selectedUIConfig =
      this.state.allUIConfigs.find(
        uiConfig => uiConfig.id === Number.parseInt(event.target.value)
      ) || this.state.activeUIConfig;
    this.setState({activeUIConfig: selectedUIConfig});
  }

  selectBackendConfig(event: SelectChangeEvent) {
    const selectedBackendConfig =
      this.state.allBackendConfigs.find(
        backendConfig => backendConfig.id === Number.parseInt(event.target.value)
      ) || this.state.activeBackendConfig;
    this.setState({activeBackendConfig: selectedBackendConfig});
  }

  createCustomUIConfig = () => this.setState({uiConfigModalOpen: true});

  closeUIConfigModal = (new_config: UIConfig | null) => {
    if (new_config === null) {
      this.setState({uiConfigModalOpen: false});
      return;
    }
    const last_id = this.state.allUIConfigs.reduce(
      (max, config) => Math.max(max, config.id),
      0
    );
    new_config.id = last_id + 1;

    this.setState(
      {
        uiConfigModalOpen: false,
        activeUIConfig: new_config,
        allUIConfigs: [...this.state.allUIConfigs, new_config],
      },
      () =>
        axios.post('/save_ui_config', new_config).then(res => {
          console.log(res);
        })
    );
  };

  createCustomBackendConfig = () => this.setState({backendConfigModalOpen: true});

  closeBackendConfigModal = (new_config: BackendConfig | null) => {
    if (new_config === null) {
      this.setState({backendConfigModalOpen: false});
      return;
    }
    const last_id = this.state.allBackendConfigs.reduce(
      (max, config) => Math.max(max, config.id),
      0
    );
    new_config.id = last_id + 1;

    this.setState(
      {
        backendConfigModalOpen: false,
        activeBackendConfig: new_config,
        allBackendConfigs: [...this.state.allBackendConfigs, new_config],
      },
      () =>
        axios.post('/save_backend_config', new_config).then(res => {
          console.log(res);
        })
    );
  }

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
          this.state.activeBackendConfig.samplingStrategy
      )
      .then(res => {
        this.setState(
          {
            sessionId: res.data.session_id,
            startModalOpen: this.state.app_mode !== "study",
            currentStep: 0,
            activeEnvId: res.data.environment_id,
          },
          () => {
            this.getEpisodeIDsChronologically(() => {
              this.sampleEpisodes();
            });
            this.getActionLabels(this.state.activeEnvId);
          }
        );
      });
  }

  closeStartModal() {
    if (this.state.app_mode === 'study') {
      // Set project, episode and experiment
      this.setState(
        {
          selectedProject:
            this.state.projects.find(project => project.id === 0) ||
            this.state.selectedProject,
          selectedExperiment:
            this.state.experiments.find(experiment => experiment.id === 8) ||
            this.state.selectedExperiment,
          activeUIConfig:
            this.state.allUIConfigs.find(
              UIConfig => UIConfig.name === 'Study'
            ) || this.state.activeUIConfig,
          activeBackendConfig:
            this.state.allBackendConfigs.find(
              backendConfig => backendConfig.name === 'Study'
            ) || this.state.activeBackendConfig,
        },
        this.resetSampler
      );
    }
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

  submitDemoFeedback(feedback: Feedback) {
    if (this.state.sessionId !== '-') {
      axios.post('/data/give_feedback', feedback).catch(error => {
        console.log(error);
      });
      this.setState({
        scheduledFeedback: [...this.state.scheduledFeedback, feedback],
      });
    }
  }

  async sampleEpisodes() {
    // Call sample_episodes and then put the returned episodes into the activeEpisodeIDs
    if (this.state.selectedExperiment.id === -1) {
      return;
    }
    await axios({
      method: 'get',
      params: {num_episodes: this.state.activeUIConfig.max_ranking_elements},
      url: '/data/sample_episodes',
    }).then(res => {
      const old_current_step = this.state.currentStep;

      this.setState({
        activeEpisodes: res.data,
        rankeableEpisodeIDs: res.data.map((e: Episode) => IDfromEpisode(e)),
        currentStep: old_current_step + 1,
        endModalOpen: res.data.length === 0,
      });
    });
  }

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

  getActionLabels = async (envId: string) => {
    axios
      .post('/data/get_action_label_urls', {
        envId: envId,
      })
      .then(response => {
        const actionLabels = response.data.map((url: string, index: number) => {
          return (
            <g key={'action_' + index}>
              <image href={url} width="18" height="18" />
            </g>
          );
        });
        this.setState({
          actionLabels: actionLabels,
        });
      });
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
          rewardsCache: newRewardsCache,
        });
        return newRewardsCache[episodeId];
      });
    }
  };

  getUncertainty = async (episodeId: string) => {
    if (this.state.uncertaintyCache[episodeId]) {
      return this.state.uncertaintyCache[episodeId];
    } else {
      await axios({
        method: 'get',
        url: 'data/get_uncertainty',
        params: EpisodeFromID(episodeId),
      }).then(response => {
        const newUncetaintyCache = this.state.uncertaintyCache;
        newUncetaintyCache[episodeId] = Array.from(
          new Float32Array(response.data)
        );
        this.setState({
          uncertaintyCache: newUncetaintyCache,
        });
        return newUncetaintyCache[episodeId];
      });
    }
  };

  hasFeedback(episode: Episode, feedbackType: FeedbackType) {
    for (const feedback of this.state.scheduledFeedback) {
      if (feedback.targets === null) {
        continue;
      }
      if (
        IDfromEpisode(feedback.targets[0].reference) ===
          IDfromEpisode(episode) &&
        feedback.feedback_type === feedbackType
      ) {
        return true;
      }
    }

    // If no feedback matched.
    return false;
  }

  toggleAppMode(newMode: AppMode) {
    this.setState({
      app_mode: newMode,
      status_bar_collapsed: newMode === 'study',
    });
  }

  render() {
    return (
      <ThemeProvider
        theme={createTheme(getDesignTokens(this.state.theme as PaletteMode))}
      >
        <GetterContext.Provider
          value={{
            getVideoURL: this.getVideoURL.bind(this),
            getThumbnailURL: this.getThumbnailURL.bind(this),
            getRewards: this.getRewards.bind(this),
            getUncertainty: this.getUncertainty.bind(this),
          }}
        >
          <UIConfigContext.Provider value={this.state.activeUIConfig}>
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
                  bgcolor: createTheme(
                    getDesignTokens(this.state.theme as PaletteMode)
                  ).palette.background.l1,
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
                  activeUIConfigId={this.state.activeUIConfig.id.toString()}
                  activeBackendConfigId={this.state.activeBackendConfig.id.toString()}
                  selectUIConfig={this.selectUIConfig.bind(this)}
                  selectBackendConfig={this.selectBackendConfig.bind(this)}
                  allUIConfigs={this.state.allUIConfigs}
                  allBackendConfigs={this.state.allBackendConfigs}
                  createCustomUIConfig={this.createCustomUIConfig.bind(this)}
                  createCustomBackendConfig={this.createCustomBackendConfig.bind(this)}
                  resetSampler={this.resetSampler.bind(this)}
                  sessionId={this.state.sessionId}
                  allThemes={this.state.allThemes}
                  selectTheme={(event: SelectChangeEvent) =>
                    this.setState({theme: event.target.value})
                  }
                  activeTheme={this.state.theme}
                />
                <Box sx={{display: 'flex', flexDirection: 'row'}}>
                  <IconButton
                    disabled={this.state.app_mode === 'study'}
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
                    sx={{
                      marginRight: '2vw',
                      marginTop: '0.2vh',
                      float: 'right',
                    }}
                  />
                  {this.state.status_bar_collapsed && (
                    <Typography
                      sx={{
                        width: '45vw',
                        fontWeight: 'bold',
                        margin: 'auto',
                        marginTop: '0.6vh',
                        float: 'right',
                        color: createTheme(
                          getDesignTokens(this.state.theme as PaletteMode)
                        ).palette.text.primary,
                      }}
                    >
                      RLHF-Blender v0.1
                    </Typography>
                  )}
                </Box>
              </Box>
              {this.state.selectedProject.id >= 0 ? (
                <FeedbackInterface
                  currentProgressBarStep={this.state.currentStep}
                  episodeIDsChronologically={this.state.episodeIDsChronologically}
                  activeUIConfig={this.state.activeUIConfig}
                  parentWidthPx={this.scrollableListContainerRef.current?.clientWidth}
                  rankeableEpisodeIDs={this.state.rankeableEpisodeIDs}
                  activeEnvId={this.state.activeEnvId}
                  scheduleFeedback={this.scheduleFeedback.bind(this)}
                  actionLabels={this.state.actionLabels}
                  sessionId={this.state.sessionId}
                  onDemoModalSubmit={this.submitDemoFeedback.bind(this)}
                  submitFeedback={this.submitFeedback.bind(this)}
                  hasFeedback={this.hasFeedback.bind(this)} onDragEnd={function (dropResult: DropResult): void {
                    throw new Error('Function not implemented.');
                  } } columnOrder={[]} ranks={{}}                />
              ) : null}
              <ConfigModal
                config={this.state.activeUIConfig}
                open={this.state.uiConfigModalOpen}
                onClose={this.closeUIConfigModal.bind(this)}
              />
              <ConfigModal
                config={this.state.activeBackendConfig}
                open={this.state.backendConfigModalOpen}
                onClose={this.closeBackendConfigModal.bind(this)}
              />
              <ExperimentStartModal
                feedbackComponents={
                  this.state.activeUIConfig.feedbackComponents
                }
                content={this.state.startModalContent}
                open={this.state.startModalOpen}
                toggleAppMode={this.toggleAppMode.bind(this)}
                onClose={this.closeStartModal.bind(this)}
              />
              <ExperimentEndModal
                open={this.state.endModalOpen}
              ></ExperimentEndModal>
              <Button
                sx={{
                  position: 'absolute',
                  bottom: '2vh',
                  right: '2vw',
                  visibility: this.state.app_mode === 'configure' ? 'visible' : 'hidden',
                  backgroundColor: '#29b6f6',
                }}
                variant="contained"
                onClick={() => {
                  axios
                    .post('/save_ui_config', this.state.activeUIConfig)
                    .then(res => {
                    });
                }}
              >  
                Save Current Config For Study
              </Button>
              <Chip 
                sx={{
                  position: 'absolute',
                  top: '2vh',
                  right: '2vw',
                  visibility: this.state.app_mode === 'configure' ? 'visible' : 'hidden',
                }}
                label="Config Mode"
                color="warning"
              />
            </Box>
          </UIConfigContext.Provider>
        </GetterContext.Provider>
      </ThemeProvider>
    );
  }
}

export default App;
