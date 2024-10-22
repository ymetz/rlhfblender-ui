import React, {useRef, useEffect, useState, useContext} from 'react';

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
import EvalIcon from '../../icons/eval-icon';
import FeatIcon from '../../icons/feat-icon';
import CorrIcon from '../../icons/corr-icon';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import Fade from '@mui/material/Fade';
import Dialog from '@mui/material/Dialog';
import {useTheme} from '@mui/material/styles';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import chroma from 'chroma-js';
// Axios
import axios from 'axios';

// Types
import {EpisodeFromID} from '../../id';
import {Feedback, FeedbackType} from '../../types';

// Our components
import TimelineChart from './timeline-chart';
import FeatureHighlightModal from './feature-highlight-modal';
import CorrectionModal from '../modals/correction-modal';

// Context
import {UIConfigContext} from '../../setup-ui-context';
import {useGetter} from '../../getter-context';
import {styled} from '@mui/system';
import {ParentSize} from '@visx/responsive';
import {useRatingInfo} from '../../rating-info-context';
import Button from '@mui/material/Button';
import DemoIcon from '../../icons/demo-icon';

interface EpisodeItemContainerProps {
  isDragging?: boolean;
  horizontalRanking?: boolean;
  numItemsInColumn?: number;
  hasFeedback?: boolean;
  isOnSubmit?: boolean;
}

const EpisodeItemContainer = styled('div')<EpisodeItemContainerProps>(
  ({
    theme,
    isDragging,
    horizontalRanking,
    numItemsInColumn,
    isOnSubmit,
    hasFeedback,
  }) => ({
    backgroundColor: isDragging
      ? chroma
          .mix(theme.palette.background.l1, theme.palette.primary.main, 0.05)
          .hex()
      : theme.palette.background.l1,
    flex: 1,
    borderRadius: '10px',
    margin: '10px',
    display: 'grid',
    border: `1px solid ${theme.palette.divider}`,
    justifyItems: 'stretch',
    boxShadow:
      isOnSubmit && hasFeedback
        ? `0px 0px 20px 0px ${theme.palette.primary.main}`
        : 'none',
    transition: 'box-shadow 0.2s ease-in-out',
    gridTemplateColumns:
      horizontalRanking && numItemsInColumn === 1
        ? '1fr'
        : 'auto auto minmax(50%, 1fr) auto',
    gridTemplateRows:
      horizontalRanking && numItemsInColumn === 1
        ? 'auto auto auto auto auto'
        : 'auto auto auto',
    gridTemplateAreas:
      horizontalRanking && numItemsInColumn === 1
        ? `"drag"
        "video"
        "timelinechart"
        "mission"
        "evaluative"
        "demo"
        `
        : `"drag video evaluative demo"
      "drag video timelinechart timelinechart"
      "drag video mission mission"`,
  })
);

const DragHandleContainer = styled('div')({
  gridArea: 'drag',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  cursor: 'grab',
});

const EvaluativeContainer = styled('div')<EpisodeItemContainerProps>(
  ({theme, hasFeedback, horizontalRanking, isOnSubmit}) => ({
    gridArea: 'evaluative',
    display: 'grid',
    gridTemplateColumns: 'auto auto 1fr auto',
    gridTemplateRows: '1fr',
    borderRadius: '10px',
    boxShadow:
      isOnSubmit && hasFeedback
        ? `0px 0px 20px 0px ${theme.palette.primary.main}`
        : 'none',
    transition: 'box-shadow 0.2s ease-in-out',
    border: hasFeedback
      ? `1px solid ${theme.palette.primary.main}`
      : `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.l0,
    margin: '10px',
    alignItems: 'center',
    width: horizontalRanking ? 'auto' : '50%',
  })
);

interface EpisodeItemProps {
  episodeID: string;
  index: number;
  scheduleFeedback: (pendingFeedback: Feedback) => void;
  numItemsInColumn: number;
  sessionId: string;
  evalFeedback: number | undefined;
  updateEvalFeedback: (episodeId: string, rating: number) => void;
  setDemoModalOpen: ({open, seed}: {open: boolean; seed: number}) => void;
  actionLabels?: any[];
}

type StepDetails = {
  action_distribution: number[];
  action: number | number[];
  reward: number;
  info: {[key: string]: string} & {mission?: string; seed?: number};
  action_space: object;
};

const EpisodeItem: React.FC<EpisodeItemProps> = React.memo(({
  episodeID,
  index,
  scheduleFeedback,
  sessionId,
  numItemsInColumn,
  evalFeedback,
  updateEvalFeedback,
  setDemoModalOpen,
  actionLabels = [],
}) => {
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const [videoURL, setVideoURL] = useState('');
  const [playing, setPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoSliderValue, setVideoSliderValue] = useState(0);
  const [evaluativeSliderValue, setEvaluativeSliderValue] = useState(
    evalFeedback || 5
  );
  const [mouseOnVideo, setMouseOnVideo] = useState(false);
  const [rewards, setRewards] = useState<number[]>([]);
  const [uncertainty, setUncertainty] = useState<number[]>([]);
  const [actions, setActions] = useState<number[]>([]);
  const [highlightModelOpen, setHighlightModelOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
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
  const UIConfig = useContext(UIConfigContext);
  const {isOnSubmit, hasFeedback} = useRatingInfo();

  // Whether this episode has already received feedback
  const hasEvaluativeFeedback = hasFeedback(
    EpisodeFromID(episodeID),
    FeedbackType.Evaluative
  );
  const hasCorrectiveFeedback = hasFeedback(
    EpisodeFromID(episodeID),
    FeedbackType.Corrective
  );
  const hasFeatureSelectionFeedback = hasFeedback(
    EpisodeFromID(episodeID),
    FeedbackType.FeatureSelection
  );

  const {getThumbnailURL, getVideoURL, getRewards, getUncertainty} =
    useGetter();

    useEffect(() => {
      getVideoURL(episodeID).then(url => {
        setVideoURL(url || '');
      });
    }, [episodeID, getVideoURL]);

  // Retreive details for the particular step of the episode by calling "/get_single_step_details" with the episode ID and step number
  useEffect(() => {
    axios
      .post('/data/get_single_step_details', {
        ...EpisodeFromID(episodeID || ''),
        step: 0,
      })
      .then((response: any) => {
        setStepDetails(response.data);
      })
      .catch((error: any) => {
        console.log(error);
      });
  }, [episodeID]);

  useEffect(() => {
    axios
      .post('/data/get_actions_for_episode', {
        ...EpisodeFromID(episodeID || ''),
      })
      .then((response: any) => {
        setActions(response.data);
      })
      .catch((error: any) => {
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
    if (UIConfig.uiComponents.uncertaintyLine) {
      getUncertainty(episodeID).then(uncertainty => {
        setUncertainty(uncertainty ? uncertainty : []);
      });
    }
  }, [
    episodeID,
    getUncertainty,
    UIConfig.uiComponents.showUncertainty,
    UIConfig.uiComponents.uncertaintyLine,
  ]);

  useEffect(() => {
    if (playing) {
      const interval = setInterval(() => {
        // Make sure currentTime is not NaN
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
    if (UIConfig.uiComponents.showProposedFeedback) {
      setProposedFeedbackMarkers(
        Array.from({length: 4}, (_, i) => ({
          x: Math.floor(Math.random() * rewards.length),
          y: Math.floor(Math.random() * 10),
        }))
      );
    }
  };

  const videoSliderHandler = (value: number | number[]) => {
    // Check if nan
    videoRef.current.currentTime = Number.isNaN(value) ? 0 : (value as number);
    setVideoSliderValue(Number.isNaN(value) ? 0 : (value as number));
  };

  const evaluativeFeedbackHandler = (
    _: Event | React.SyntheticEvent<Element, Event>,
    value: number | number[]
  ) => {
    const feedback: Feedback = {
      feedback_type: FeedbackType.Evaluative,
      targets: [
        {
          target_id: episodeID,
          reference: EpisodeFromID(episodeID || ''),
          origin: 'offline',
          timestamp: Date.now(),
        },
      ],
      granularity: 'episode',
      timestamp: Date.now(),
      session_id: sessionId,
      score: value as number,
    };

    setEvaluativeSliderValue(value as number);
    updateEvalFeedback(episodeID, value as number);
    scheduleFeedback(feedback);
  };

  const onCorrectionModalOpenHandler = (step: number) => {
    setSelectedStep(step);
    setCorrectionModalOpen(true);
  };

  const onFeatureSelectionSubmit = (feedback: Feedback) => {
    if (sessionId !== '-') {
      scheduleFeedback(feedback);
    }
  };

  const onCorrectionModalSubmit = (feedback: Feedback, step: number) => {
    setGivenFeedbackMarkers([
      ...givenFeedbackMarkers,
      {x: step, y: feedback.numeric_feedback},
    ]);
    setCorrectionModalOpen(false);
    if (sessionId !== '-') {
      scheduleFeedback(feedback);
    }
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
      {(provided, snapshot) => (
        <EpisodeItemContainer
          horizontalRanking={UIConfig.uiComponents.horizontalRanking}
          numItemsInColumn={numItemsInColumn}
          isDragging={snapshot.isDragging}
          ref={provided.innerRef}
          isOnSubmit={isOnSubmit}
          hasFeedback={false}
          {...provided.draggableProps}
        >
          {/* Drag handle */}
          <DragHandleContainer {...provided.dragHandleProps}>
            <DragIndicator
              sx={{
                transform:
                  UIConfig.uiComponents.horizontalRanking &&
                  numItemsInColumn === 1
                    ? 'rotate(90deg)'
                    : 'none',
                m: 1,
                color: theme.palette.text.secondary,
              }}
            />
          </DragHandleContainer>

          {/* Video */}
          <Box
            sx={{
              gridArea: 'video',
              justifySelf: 'center',
              alignSelf: 'center',
              borderRadius: '10px',
              border: hasFeatureSelectionFeedback
                ? `1px solid ${theme.palette.primary.main}`
                : `1px solid ${theme.palette.divider}`,
              boxShadow:
                isOnSubmit && hasFeatureSelectionFeedback
                  ? `0px 0px 20px 0px ${theme.palette.primary.main}`
                  : 'none',
              m: 1,
              overflow: 'hidden',
              position: 'relative',
              width: '100%',
              height: '100%',
              maxHeight: '25vh',
              maxWidth: '25vh',
            }}
          >
            {videoURL && (
              <video
                ref={videoRef}
                onLoadedMetadata={onLoadMetaDataHandler}
                controlsList={mouseOnVideo ? 'default' : 'none'}
                loop
                onMouseEnter={onVideoMouseEnterHandler}
                onMouseLeave={onVideoMouseLeaveHandler}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              >
                <source src={videoURL} type="video/mp4" />
              </video>
            )}
            <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                display: 'grid',
                gridTemplateRows: '1fr',
                gridTemplateColumns: UIConfig.uiComponents.featureSelection
                  ? '1fr'
                  : '75% auto',
              }}
            >
              <Fade in={mouseOnVideo} timeout={500}>
                <Box
                  onMouseEnter={onVideoMouseEnterHandler}
                  onMouseLeave={onVideoMouseLeaveHandler}
                  sx={{
                    gridTemplateRows: '1fr',
                    gridTemplateColumns: '1fr 1fr 1fr',
                  }}
                >
                  <IconButton className="controls_icons" aria-label="reqind">
                    <FastRewind style={{color: theme.palette.text.secondary}} />
                  </IconButton>
                  <IconButton
                    className="controls_icons"
                    aria-label="reqind"
                    onClick={playButtonHandler}
                  >
                    {!playing ? (
                      <PlayArrowSharp
                        style={{color: theme.palette.text.secondary}}
                      />
                    ) : (
                      <PauseSharp
                        style={{color: theme.palette.text.secondary}}
                      />
                    )}
                  </IconButton>

                  <IconButton className="controls_icons" aria-label="reqind">
                    <FastForwardSharp
                      style={{color: theme.palette.text.secondary}}
                    />
                  </IconButton>
                </Box>
              </Fade>
              {UIConfig.feedbackComponents.featureSelection && (
                <IconButton
                  onClick={() => setHighlightModelOpen(!highlightModelOpen)}
                >
                  <FeatIcon
                    color={
                      hasFeatureSelectionFeedback
                        ? theme.palette.primary.main
                        : theme.palette.text.secondary
                    }
                  />
                </IconButton>
              )}
            </Box>
          </Box>

          {/* Evaluative feedback and timechart slider */}
          <EvaluativeContainer
            hasFeedback={hasEvaluativeFeedback}
            isOnSubmit={isOnSubmit}
            horizontalRanking={UIConfig.uiComponents.horizontalRanking}
          >
            <Box
              sx={{
                m: 1,
                p: 1,
                borderRight: `1px solid ${theme.palette.divider}`,
              }}
            >
              <EvalIcon
                color={
                  hasEvaluativeFeedback
                    ? theme.palette.primary.main
                    : theme.palette.text.secondary
                }
              />
            </Box>
            <ThumbDown
              sx={{
                color: theme.palette.text.secondary,
                m: 1,
                height: '1vw',
                '&:hover': {
                  color: theme.palette.primary.main,
                },
              }}
              onClick={_ =>
                setEvaluativeSliderValue(Math.max(0, evaluativeSliderValue - 1))
              }
            />
            <Slider
              step={1}
              min={0}
              max={10}
              value={evaluativeSliderValue}
              valueLabelDisplay="auto"
              aria-label="Custom thumb label"
              defaultValue={5}
              marks
              sx={{
                color: chroma
                  .mix(
                    theme.palette.primary.main,
                    theme.palette.text.secondary,
                    1.0 - (evaluativeSliderValue + 1) / 10
                  )
                  .hex(),
              }}
              onChangeCommitted={evaluativeFeedbackHandler}
            />
            <ThumbUp
              sx={{
                color: theme.palette.primary.main,
                m: 1,
                height: '1vw',
              }}
              onClick={_ =>
                setEvaluativeSliderValue(
                  Math.min(10, evaluativeSliderValue + 1)
                )
              }
            />
          </EvaluativeContainer>
          <Box
            sx={{
              display: 'flex',
              gridArea: 'demo',
            }}
          >
            {UIConfig.feedbackComponents.demonstration && (
              <Box
                sx={{
                  p: 1,
                  m: 1,
                  backgroundColor: theme.palette.background.l1,
                  overflow: 'hidden',
                }}
              >
                <Button
                  variant="contained"
                  onClick={() =>
                    setDemoModalOpen({
                      open: true,
                      seed: stepDetails.info?.seed || 0,
                    })
                  }
                  endIcon={
                    <DemoIcon color={theme.palette.primary.contrastText} />
                  }
                >
                  Demo
                </Button>
              </Box>
            )}
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: '10px',
              m: 1,
              border: hasCorrectiveFeedback
                ? `1px solid ${theme.palette.primary.main}`
                : `1px solid ${theme.palette.divider}`,
              backgroundColor: theme.palette.background.l0,
              boxShadow:
                isOnSubmit && hasCorrectiveFeedback
                  ? `0px 0px 20px 0px ${theme.palette.primary.main}`
                  : 'none',
              gridArea: 'timelinechart',
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                m: 1,
                p: 1,
                borderRight: `1px solid ${theme.palette.divider}`,
                height: '100%',
              }}
            >
              <Tooltip title="Double Click to Correct">
                <CorrIcon
                  color={
                    hasCorrectiveFeedback
                      ? theme.palette.primary.main
                      : theme.palette.text.secondary
                  }
                />
              </Tooltip>
            </Box>
            <ParentSize>
              {parent => (
                <TimelineChart
                  rewards={rewards}
                  uncertainty={
                    UIConfig.uiComponents.uncertaintyLine ? uncertainty : []
                  }
                  actions={actions}
                  actionLabels={
                    UIConfig.uiComponents.actionLabels ? actionLabels : []
                  }
                  width={parent.width - 20}
                  height={100}
                  videoDuration={videoDuration}
                  tooltipLeft={videoSliderValue}
                  givenFeedbackMarkers={givenFeedbackMarkers}
                  proposedFeedbackMarkers={proposedFeedbackMarkers}
                  onChange={videoSliderHandler}
                  onCorrectionClick={onCorrectionModalOpenHandler}
                />
              )}
            </ParentSize>
          </Box>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              borderRadius: '10px',
              backgroundColor: theme.palette.background.l0,
              border: `1px solid ${theme.palette.divider}`,
              m: 1,
              p: 1,
              overflow: 'hidden',
              gridArea: 'mission',
            }}
          >
            {Object.prototype.hasOwnProperty.call(
              stepDetails?.info,
              'mission'
            ) ? (
              <Typography color={theme.palette.text.primary}>
                Mission: {stepDetails?.info?.mission || ''}
              </Typography>
            ) : (
              <></>
            )}
          </Box>

          <Dialog open={highlightModelOpen}>
            <FeatureHighlightModal
              episodeId={episodeID}
              getThumbnailURL={getThumbnailURL}
              onClose={() => setHighlightModelOpen(false)}
              onCloseSubmit={onFeatureSelectionSubmit}
              sessionId={sessionId}
            />
          </Dialog>
          <CorrectionModal
            open={correctionModalOpen}
            episodeId={episodeID}
            step={selectedStep}
            frame={getSingleFrame(videoRef.current, selectedStep)}
            onClose={() => setCorrectionModalOpen(false)}
            onCloseSubmit={onCorrectionModalSubmit}
            custom_input={UIConfig?.customInput}
            sessionId={sessionId}
            inputProps={{}}
          />
        </EpisodeItemContainer>
      )}
    </Draggable>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.episodeID === nextProps.episodeID &&
    prevProps.index === nextProps.index &&
    prevProps.numItemsInColumn === nextProps.numItemsInColumn &&
    prevProps.sessionId === nextProps.sessionId &&
    prevProps.evalFeedback === nextProps.evalFeedback &&
    prevProps.actionLabels === nextProps.actionLabels
  );
}
);

export default React.memo(EpisodeItem);
