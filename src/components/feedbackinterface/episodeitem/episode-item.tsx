import React, {useRef, useEffect, useState} from 'react';

import {Draggable} from 'react-beautiful-dnd';

// MUI
import chroma from 'chroma-js';
// Axios
import axios from 'axios';

// Types
import {EpisodeFromID} from '../../../id';
import {Feedback, FeedbackType} from '../../../types';

// Context
import { useSetupConfigState } from '../../../SetupConfigContext';
import {useGetter} from '../../../getter-context';
import {styled} from '@mui/system';
import {useRatingInfo} from '../../../rating-info-context';
import EnvRender from './env-render';
import TimelineSection from './timeline-section';
import EvaluativeFeedback from './evaluative-feedback';
import Modals from './modals';
import DragHandle from './drag-handle';
import DemoSection from './demo-section';
import TextFeedback from './text-feedback';

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
        "envRender"
        "timelinechart"
        "mission"
        "evaluative"
        "demo"
        `
        : `"drag envRender evaluative demo"
      "drag envRender timelinechart timelinechart"
      "drag envRender mission mission"`,
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
  const UIConfig = useSetupConfigState().activeUIConfig;
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
          <DragHandle {...provided.dragHandleProps} horizontalRanking={UIConfig.uiComponents.horizontalRanking} />
          
          <EnvRender
            videoRef={videoRef}
            videoURL={videoURL}
            onLoadMetadata={onLoadMetaDataHandler}
            hasFeatureSelectionFeedback={hasFeatureSelectionFeedback}
            showFeatureSelection={UIConfig.feedbackComponents.featureSelection}
            onFeatureSelect={() => setHighlightModelOpen(true)}
            playButtonHandler={playButtonHandler}
            playing={playing}
            mission={stepDetails?.info?.mission}
            horizontalRanking={UIConfig.uiComponents.horizontalRanking}
          />

          <EvaluativeFeedback
            value={evaluativeSliderValue}
            onChange={setEvaluativeSliderValue}
            onCommit={evaluativeFeedbackHandler}
            hasEvaluativeFeedback={hasEvaluativeFeedback}
            isOnSubmit={isOnSubmit}
            horizontalRanking={UIConfig.uiComponents.horizontalRanking}
          />

          <DemoSection
            showDemo={UIConfig.feedbackComponents.demonstration}
            onDemoClick={() => setDemoModalOpen({
              open: true,
              seed: stepDetails.info?.seed || 0,
            })}
          />

          <TimelineSection
            rewards={rewards}
            uncertainty={UIConfig.uiComponents.uncertaintyLine ? uncertainty : []}
            actions={actions}
            actionLabels={UIConfig.uiComponents.actionLabels ? actionLabels : []}
            videoDuration={videoDuration}
            videoSliderValue={videoSliderValue}
            givenFeedbackMarkers={givenFeedbackMarkers}
            proposedFeedbackMarkers={proposedFeedbackMarkers}
            onSliderChange={videoSliderHandler}
            onCorrectionClick={onCorrectionModalOpenHandler}
            hasCorrectiveFeedback={hasCorrectiveFeedback}
            isOnSubmit={isOnSubmit}
          />

          <TextFeedback
            showTextFeedback={UIConfig.feedbackComponents.text}
            episodeId={episodeID}
            sessionId={sessionId}
            scheduleFeedback={scheduleFeedback}
          />

          <Modals
            highlightModalOpen={highlightModelOpen}
            correctionModalOpen={correctionModalOpen}
            episodeId={episodeID}
            selectedStep={selectedStep}
            videoRef={videoRef}
            sessionId={sessionId}
            onHighlightClose={() => setHighlightModelOpen(false)}
            onHighlightSubmit={onFeatureSelectionSubmit}
            onCorrectionClose={() => setCorrectionModalOpen(false)}
            onCorrectionSubmit={onCorrectionModalSubmit}
            customInput={UIConfig?.customInput}
            getThumbnailURL={getThumbnailURL}
          />
        </EpisodeItemContainer>
      )}
    </Draggable>
  );
});

export default React.memo(EpisodeItem);