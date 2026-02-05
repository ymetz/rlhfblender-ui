import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// MUI
import chroma from "chroma-js";
// Axios
import axios from "axios";
import { styled } from "@mui/system";
import { IconButton } from "@mui/material";
import { Check } from "@mui/icons-material";

// Components
import VideoPlaybackContainer from "./video-playback-container";
import DragHandle from "./drag-handle";
import EvaluativeFeedback from "./evaluative-feedback";
import DemoSection from "./demo-section";
import TextFeedback from "./text-feedback";
import Modals from "./modals";

// Types and Context
import { EpisodeFromID } from "../../../id";
import { Feedback, FeedbackType } from "../../../types";
import { useSetupConfigState } from "../../../SetupConfigContext";
import { useGetter } from "../../../getter-context";
import { useRatingInfo } from "../../../rating-info-context";

interface EpisodeItemContainerProps {
  isDragging?: boolean;
  horizontalRanking?: boolean;
  hasFeedback?: boolean;
  isBestOfK?: boolean;
}

const EpisodeItemContainer = styled("div")<EpisodeItemContainerProps>(
  ({ theme, isDragging, horizontalRanking, hasFeedback, isBestOfK }) => ({
    backgroundColor: isDragging
      ? chroma
        .mix(theme.palette.background.l1, theme.palette.primary.main, 0.05)
        .hex()
      : theme.palette.background.l1,
    flex: 1,
    borderRadius: "10px",
    margin: "10px",
    display: "grid",
    position: "relative",
    border: `1px solid ${theme.palette.divider}`,
    justifyItems: "stretch",
    boxShadow: hasFeedback
      ? `0px 0px 20px 0px ${theme.palette.primary.main}`
      : "none",
    transition: "box-shadow 0.2s ease-in-out",
    gridTemplateColumns: horizontalRanking
      ? "1fr"
      : "auto auto minmax(50%, 1fr) auto",
    gridTemplateRows: horizontalRanking
      ? "auto auto auto auto auto"
      : "auto auto auto",
    gridTemplateAreas: horizontalRanking
      ? `"envRender"
        "timelinechart"
        "mission"
        "evaluative"
        "demo"
        ${isBestOfK ? '"select"' : '"drag"'}`
      : `"drag envRender evaluative demo"
      "drag envRender timelinechart timelinechart"
      "drag envRender mission mission"`,
  }),
);

const SelectButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: "10px",
  right: "10px",
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  "&:hover": {
    backgroundColor: theme.palette.primary.dark,
  },
  "&.selected": {
    backgroundColor: theme.palette.success.main,
    "&:hover": {
      backgroundColor: theme.palette.success.dark,
    },
  },
  width: "40px",
  height: "40px",
}));

interface EpisodeItemProps {
  episodeID: string;
  containerId: string;
  scheduleFeedback: (pendingFeedback: Feedback) => void;
  selectBest: (episodeId: string) => void;
  isSelectedAsBest?: boolean;
  sessionId: string;
  evalFeedback: number | undefined;
  updateEvalFeedback: (episodeId: string, rating: number) => void;
  setDemoModalOpen: ({ open, seed }: { open: boolean; seed: number }) => void;
  actionLabels?: any[];
  isBestOfK?: boolean;
  onMouseEnter: (episodeId: string) => void;
  onMouseLeave: () => void;
  isHovered: boolean;
}

type StepDetails = {
  action_distribution: number[];
  action: number | number[];
  reward: number;
  info: { [key: string]: string } & { mission?: string; seed?: number };
  action_space: object;
};

const EpisodeItem: React.FC<EpisodeItemProps> = ({
  episodeID,
  containerId,
  scheduleFeedback,
  selectBest,
  isSelectedAsBest,
  sessionId,
  evalFeedback,
  updateEvalFeedback,
    setDemoModalOpen,
    actionLabels = [],
    isBestOfK = false,
    onMouseEnter,
    onMouseLeave,
    isHovered,
  }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: episodeID,
    data: { containerId },
    disabled: isBestOfK,
  });

  const videoRef = useRef<HTMLVideoElement>(document.createElement("video"));
  const [videoURL, setVideoURL] = useState("");
  const [evaluativeSliderValue, setEvaluativeSliderValue] = useState(
    evalFeedback || 5,
  );
  const [rewards, setRewards] = useState<number[]>([]);
  const [uncertainty, setUncertainty] = useState<number[]>([]);
  const [actions, setActions] = useState<number[]>([]);
  const [highlightModelOpen, setHighlightModelOpen] = useState(false);
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState(0);
  const [givenFeedbackMarkers, setGivenFeedbackMarkers] = useState<any[]>([]);
  const [proposedFeedbackMarkers, setProposedFeedbackMarkers] = useState<
    any[]
  >([]);
  const [stepDetails, setStepDetails] = useState<StepDetails>({
    action_distribution: [],
    action: 0,
    reward: 0,
    info: {},
    action_space: {},
  });

  // Hooks
  const UIConfig = useSetupConfigState().activeUIConfig;
  const { hasFeedback } = useRatingInfo();
  const { getThumbnailURL, getVideoURL, getRewards, getUncertainty } = useGetter();

  // Feedback status checks - memoized to prevent recalculation on every render
  const feedbackStatus = useMemo(() => ({
    hasEvaluativeFeedback: hasFeedback(
      EpisodeFromID(episodeID),
      FeedbackType.Evaluative,
    ),
    hasCorrectiveFeedback: hasFeedback(
      EpisodeFromID(episodeID),
      FeedbackType.Corrective,
    ),
    hasFeatureSelectionFeedback: hasFeedback(
      EpisodeFromID(episodeID),
      FeedbackType.FeatureSelection,
    ),
    hasTextFeedback: hasFeedback(
      EpisodeFromID(episodeID),
      FeedbackType.Text,
    ),
    hasDemoFeedback: hasFeedback(
      EpisodeFromID(episodeID),
      FeedbackType.Demonstrative,
    ),
  }), [episodeID, hasFeedback]);

  // Data fetching - using useEffect with proper dependencies
  useEffect(() => {
    getVideoURL(episodeID).then((url) => {
      setVideoURL(url || "");
    });
  }, [episodeID, getVideoURL]);

  useEffect(() => {
    axios
      .post("/data/get_single_step_details", {
        ...EpisodeFromID(episodeID || ""),
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
      .post("/data/get_actions_for_episode", {
        ...EpisodeFromID(episodeID || ""),
      })
      .then((response: any) => {
        setActions(response.data);
      })
      .catch((error: any) => {
        console.log(error);
      });
  }, [episodeID]);

  useEffect(() => {
    getRewards(episodeID).then((rewardsData) => {
      setRewards(rewardsData ? rewardsData : []);
    });
  }, [episodeID, getRewards]);

  useEffect(() => {
    if (UIConfig.uiComponents.uncertaintyLine) {
      getUncertainty(episodeID).then((uncertaintyData) => {
        setUncertainty(uncertaintyData ? uncertaintyData : []);
      });
    }
    return undefined;
  }, [
    episodeID,
    getUncertainty,
    UIConfig.uiComponents.showUncertainty,
    UIConfig.uiComponents.uncertaintyLine,
  ]);

  // Memoized callback handlers - prevents recreation on each render
  const onCorrectionModalOpenHandler = useCallback((step: number) => {
    if (!UIConfig.feedbackComponents.correction) return;
    setSelectedStep(step);
    setCorrectionModalOpen(true);
  }, [UIConfig.feedbackComponents.correction]);

  const onFeatureSelectionSubmit = useCallback((feedback: Feedback) => {
    if (sessionId !== "-") {
      scheduleFeedback(feedback);
    }
  }, [scheduleFeedback, sessionId]);

  const onCorrectionModalSubmit = useCallback((feedback: Feedback, step: number) => {
    setGivenFeedbackMarkers((prev) => [
      ...prev,
      { x: step, y: feedback.numeric_feedback },
    ]);
    setCorrectionModalOpen(false);
    if (sessionId !== "-") {
      scheduleFeedback(feedback);
    }
  }, [scheduleFeedback, sessionId]);

  const evaluativeFeedbackHandler = useCallback((
    _: Event | React.SyntheticEvent<Element, Event>,
    value: number | number[],
  ) => {
    const feedback: Feedback = {
      feedback_type: FeedbackType.Evaluative,
      targets: [
        {
          target_id: episodeID,
          reference: EpisodeFromID(episodeID || ""),
          origin: "offline",
          timestamp: Date.now(),
        },
      ],
      granularity: "episode",
      timestamp: Date.now(),
      session_id: sessionId,
      score: value as number,
    };

    setEvaluativeSliderValue(value as number);
    updateEvalFeedback(episodeID, value as number);
    scheduleFeedback(feedback);
  }, [episodeID, scheduleFeedback, sessionId, updateEvalFeedback]);

  const dragHandleProps = isBestOfK ? {} : { ...attributes, ...listeners };

  const EpisodeContent = (
    <EpisodeItemContainer
      horizontalRanking={UIConfig.uiComponents.horizontalRanking}
      isDragging={isBestOfK ? false : isDragging}
      hasFeedback={false}
      isBestOfK={isBestOfK}
    >
      {!isBestOfK && (
        <DragHandle
          horizontalRanking={UIConfig.uiComponents.horizontalRanking}
          {...dragHandleProps}
        />
      )}

      {isBestOfK && (
        <SelectButton
          className={isSelectedAsBest ? "selected" : ""}
          onClick={() => selectBest(episodeID)}
        >
          <Check />
        </SelectButton>
      )}

      {/* VideoPlaybackContainer - isolated playback state management */}
      <VideoPlaybackContainer
        episodeID={episodeID}
        videoURL={videoURL}
        rewards={rewards}
        uncertainty={uncertainty}
        actions={actions}
        actionLabels={UIConfig.uiComponents.actionLabels ? actionLabels : []}
        mission={stepDetails?.info?.mission}
        onCorrectionClick={onCorrectionModalOpenHandler}
        givenFeedbackMarkers={givenFeedbackMarkers}
        proposedFeedbackMarkers={proposedFeedbackMarkers}
        hasCorrectiveFeedback={feedbackStatus.hasCorrectiveFeedback}
        hasFeatureSelectionFeedback={feedbackStatus.hasFeatureSelectionFeedback}
        showFeatureSelection={UIConfig.feedbackComponents.featureSelection}
        onFeatureSelect={() => setHighlightModelOpen(true)}
        useCorrectiveFeedback={UIConfig.feedbackComponents.correction}
        videoRef={videoRef}
      />

      {UIConfig.feedbackComponents.rating && (
        <EvaluativeFeedback
          value={evaluativeSliderValue}
          onChange={setEvaluativeSliderValue}
          onCommit={evaluativeFeedbackHandler}
          hasEvaluativeFeedback={feedbackStatus.hasEvaluativeFeedback}
          horizontalRanking={UIConfig.uiComponents.horizontalRanking}
        />
      )}

      {UIConfig.feedbackComponents.text && (
        <TextFeedback
          showTextFeedback={UIConfig.feedbackComponents.text}
          episodeId={episodeID}
          sessionId={sessionId}
          scheduleFeedback={scheduleFeedback}
          hasTextFeedback={feedbackStatus.hasTextFeedback}
        />
      )}

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
  );

  // Conditionally wrap with sortable drag behavior
  if (isBestOfK) {
    return EpisodeContent;
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {EpisodeContent}
    </div>
  );
};

export default React.memo(EpisodeItem);
