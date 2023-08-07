import {useRef, useEffect, useState} from 'react';

import {Draggable} from 'react-beautiful-dnd';

// MUI
import Slider from '@mui/material/Slider';
import ThumbDown from '@mui/icons-material/ThumbDown';
import ThumbUp from '@mui/icons-material/ThumbUp';
import DragIndicator from '@mui/icons-material/DragIndicator';
import PlayArrowSharp from '@mui/icons-material/PlayArrowSharp';
import FastRewind from '@mui/icons-material/FastRewind';
import PauseSharp from '@mui/icons-material/PauseSharp';
import FastForwardSharp from '@mui/icons-material/FastForwardSharp';
import Draw from '@mui/icons-material/Draw';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Fade from '@mui/material/Fade';
import {Dialog} from '@mui/material';
import {useTheme} from '@mui/material/styles';

// Axios
import axios, {AxiosResponse} from 'axios';

// Types
import {EpisodeFromID} from '../id';
import {Feedback} from '../types';

// Our components
import TimelineChart from './timeline-chart';
import ParentSize from '@visx/responsive/lib/components/ParentSize';
import FeatureHighlightModal from './feature-highlight-modal';
import DemoModal from './demo-modal';
import React from 'react';

interface EpisodeItemProps {
  episodeID: string;
  index: number;
  horizontalDrag: boolean;
  scheduleFeedback: (pendingFeedback: Feedback) => void;
  getVideo: (videoURL: string) => Promise<string | undefined>;
  getThumbnailURL: (episodeID: string) => Promise<string | undefined>;
  getRewards: (episodeID: string) => Promise<number[] | undefined>;
  customInput: string;
}

type StepDetails = {
  action_distribution: number[];
  action: number | number[];
  reward: number;
  info: {[key: string]: string} & {mission?: string};
  action_space: object;
};

const EpisodeItem: React.FC<EpisodeItemProps> = ({
  episodeID,
  index,
  horizontalDrag,
  scheduleFeedback,
  getVideo,
  getThumbnailURL,
  getRewards,
  customInput,
}) => {
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const [videoURL, setVideoURL] = useState('');
  const [playing, setPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoSliderValue, setVideoSliderValue] = useState(0);
  const [mouseOnVideo, setMouseOnVideo] = useState(false);
  const [rewards, setRewards] = useState<number[]>([]);
  const [highlightModelOpen, setHighlightModelOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState(0);
  const [givenFeedbackMarkers, setGivenFeedbackMarkers] = useState<any[]>([]);
  const [proposedFeedbackMarkers, setProposedFeedbackMarkers] = useState<any[]>(
    []
  );
  const [stepDetails, setStepDetails] = useState<StepDetails>({
    action_distribution: [],
    action: 0,
    reward: 0,
    info: {},
    action_space: {},
  });
  const theme = useTheme();

  useEffect(() => {
    getVideo(episodeID).then(url => {
      setVideoURL(url ? url : '');
    });
  }, [episodeID, getVideo]);

  // Retreive details for the particular step of the episode by calling "/get_single_step_details" with the episode ID and step number
  useEffect(() => {
    axios
      .post('/data/get_single_step_details', {
        ...EpisodeFromID(episodeID || ''),
        step: 1,
      })
      .then((response: AxiosResponse) => {
        setStepDetails(response.data);
      })
      .catch(error => {
        console.log(error);
      });
  }, [episodeID]);

  const playButtonHandler = () => {
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      videoRef.current.play();
      setPlaying(true);
    }
  };

  useEffect(() => {
    getRewards(episodeID).then(rewards => {
      setRewards(rewards ? rewards : []);
    });
  }, [episodeID, getRewards]);

  useEffect(() => {
    if (playing) {
      const interval = setInterval(() => {
        // Maksure currentTime is not NaN
        setVideoSliderValue(
          Number.isNaN(videoRef.current.currentTime)
            ? 0
            : videoRef.current.currentTime
        );
      }, 1);
      return () => clearInterval(interval);
    }
  }, [playing]);

  const onVideoMouseEnterHandler = () => {
    setMouseOnVideo(true);
  };

  const onVideoMouseLeaveHandler = () => {
    setMouseOnVideo(false);
  };

  const onLoadMetaDataHandler = () => {
    setVideoDuration(videoRef.current.duration);
    //setProposedFeedbackMarkers(rewards.filter((_,i) => i % 20).map((reward, index) => ({x: index * 20, y: reward})));
    // Create 5 random markers in the range of 0-reward length
    //const randomMarkers = Array.from({length: 5}, () => Math.floor(Math.random() * rewards.length));
    setProposedFeedbackMarkers(
      Array.from({length: 4}, (_, i) => ({
        x: Math.floor(Math.random() * rewards.length),
        y: Math.floor(Math.random() * 10),
      }))
    );
  };

  const videoSliderHandler = (value: number | number[]) => {
    // Check if nan
    videoRef.current.currentTime = Number.isNaN(value) ? 0 : (value as number);
    setVideoSliderValue(Number.isNaN(value) ? 0 : (value as number));
  };

  console.log(stepDetails);

  const onFeedbackSliderChangeHandler = (
    _: Event | React.SyntheticEvent<Element, Event>,
    value: number | number[]
  ) => {
    const feedback: Feedback = {
      target: {episode: EpisodeFromID(episodeID || ''), step: -1},
      timestamp: Date.now().toString(),
      numeric_feedback: value as number,
    };
    scheduleFeedback(feedback);
  };

  const onDemoModalOpenHandler = (step: number) => {
    setSelectedStep(step);
    setDemoModalOpen(true);
  };

  const onDemoModalSubmit = (feedback: Feedback, step: number) => {
    setGivenFeedbackMarkers([
      ...givenFeedbackMarkers,
      {x: step, y: feedback.numeric_feedback},
    ]);
    setDemoModalOpen(false);
  };

  const getSingleFrame = (video: HTMLVideoElement, time: number) => {
    if (video === null || video.readyState < 2) {
      return '';
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL();
    }
    return '';
  };

  return (
    <Draggable draggableId={episodeID} index={index}>
      {provided => (
        <Grid
          container
          spacing={1}
          sx={{
            bgcolor: 'background.paper',
            m: 1,
            borderRadius: '10px',
            boxShadow: 5,
            flex: 1,
          }}
          ref={provided.innerRef}
          {...provided.draggableProps}
        >
          {/* Drag handle */}
          <Grid
            item
            xs={1}
            {...provided.dragHandleProps}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              borderRight: `1px solid ${theme.palette.grey[400]}`,
              alignItems: 'center',
            }}
          >
            <DragIndicator />
          </Grid>

          {/* Video */}
          <Grid
            item
            xs={'auto'}
            sx={{
              position: 'relative',
              borderRight: `1px solid ${theme.palette.grey[400]}`,
              overflow: 'hidden',
            }}
          >
            {videoURL && (
              <video
                ref={videoRef}
                onLoadedMetadata={onLoadMetaDataHandler}
                loop
                onMouseEnter={onVideoMouseEnterHandler}
                onMouseLeave={onVideoMouseLeaveHandler}
                style={{
                  minHeight: 0, // By default, minHeight is 'auto' for video, which prevents the video from being resized
                  minWidth: 0,
                }}
              >
                <source src={videoURL} type="video/mp4" />
              </video>
            )}
            <Fade in={mouseOnVideo} timeout={500}>
              <Box
                onMouseEnter={onVideoMouseEnterHandler}
                onMouseLeave={onVideoMouseLeaveHandler}
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  display: 'flex',
                  justifyContent: 'center',
                }}
              >
                <IconButton className="controls_icons" aria-label="reqind">
                  <FastRewind style={{color: 'white'}} />
                </IconButton>
                <IconButton
                  className="controls_icons"
                  aria-label="reqind"
                  onClick={playButtonHandler}
                >
                  {!playing ? (
                    <PlayArrowSharp style={{color: 'white'}} />
                  ) : (
                    <PauseSharp style={{color: 'white'}} />
                  )}
                </IconButton>

                <IconButton className="controls_icons" aria-label="reqind">
                  <FastForwardSharp style={{color: 'white'}} />
                </IconButton>

                <IconButton>
                  <Draw
                    style={{color: 'white'}}
                    onClick={() => setHighlightModelOpen(!highlightModelOpen)}
                  />
                </IconButton>
              </Box>
            </Fade>
          </Grid>

          {/* Evaluative feedback and timechart slider */}
          <Grid
            item
            xs
            sx={{
              // Without this, the Grid item will grow, since it
              // wants to accomodate the slider. However, since
              // the slider's size depends on this grid item,
              // it would grow to an indeterminate size.
              overflow: 'hidden',
            }}
          >
            <Grid container>
              <Grid
                item
                xs={12}
                sx={{borderBottom: `1px solid ${theme.palette.grey[400]}`}}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '10px',
                    m: 1,
                    border: `1px solid ${theme.palette.grey[400]}`,
                  }}
                >
                  <ThumbDown
                    sx={{margin: '0.5em', color: theme.palette.text.secondary}}
                  />
                  <Slider
                    aria-label="Custom thumb label"
                    defaultValue={50}
                    sx={{color: theme.palette.grey[600]}}
                    onChangeCommitted={onFeedbackSliderChangeHandler}
                  />
                  <ThumbUp
                    sx={{margin: '0.5em', color: theme.palette.text.secondary}}
                  />
                </Box>
              </Grid>
              <Grid item xs={12} sx={{overflow: 'hidden'}}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '10px',
                    m: 1,
                    border: `1px solid ${theme.palette.grey[400]}`,
                    overflow: 'hidden',
                  }}
                >
                  <ParentSize>
                    {({width, height}) => {
                      return (
                        <TimelineChart
                          rewards={rewards}
                          width={width}
                          height={110}
                          videoDuration={videoDuration}
                          tooltipLeft={videoSliderValue}
                          givenFeedbackMarkers={givenFeedbackMarkers}
                          proposedFeedbackMarkers={proposedFeedbackMarkers}
                          onChange={videoSliderHandler}
                          onDemoClick={onDemoModalOpenHandler}
                        />
                      );
                    }}
                  </ParentSize>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '10px',
                    m: 1,
                    overflow: 'hidden',
                  }}
                >
                  {Object.prototype.hasOwnProperty.call(
                    stepDetails?.info,
                    'mission'
                  ) ?? <>"Mission: " + {stepDetails?.info?.mission || ''}</>}
                </Box>
              </Grid>
            </Grid>
          </Grid>
          <Dialog open={highlightModelOpen}>
            <FeatureHighlightModal
              episodeId={episodeID}
              getThumbnailURL={getThumbnailURL}
              onClose={() => setHighlightModelOpen(false)}
            />
          </Dialog>
          <DemoModal
            open={demoModalOpen}
            episodeId={episodeID}
            step={selectedStep}
            frame={getSingleFrame(videoRef.current, selectedStep)}
            onClose={() => setDemoModalOpen(false)}
            onCloseSubmit={onDemoModalSubmit}
            custom_input={customInput}
            inputProps={{}}
          />
        </Grid>
      )}
    </Draggable>
  );
};

export default EpisodeItem;
