import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// MUI
import chroma from "chroma-js";
// Axios
import axios from "axios";
import { styled } from "@mui/system";
import { Box, Button, IconButton } from "@mui/material";
import { Check } from "@mui/icons-material";

// Components
import VideoPlaybackContainer from "./video-playback-container";
import DragHandle from "./drag-handle";
import EvaluativeFeedback from "./evaluative-feedback";
import TextFeedback from "./text-feedback";
import FeatureHighlightModal from "../feature-highlight-modal";
import WebRTCDemoComponent from "../../../active_learning/WebRTCDemoComponent";

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
  showBestOfKSelect?: boolean;
}

const EpisodeItemContainer = styled("div")<EpisodeItemContainerProps>(
  ({ theme, isDragging, horizontalRanking, hasFeedback, isBestOfK, showBestOfKSelect }) => ({
    backgroundColor: isDragging
      ? chroma
        .mix(theme.palette.background.l1, theme.palette.primary.main, 0.05)
        .hex()
      : theme.palette.background.l1,
    flex: "0 1 auto",
    borderRadius: "10px",
    margin: "6px",
    display: "grid",
    position: "relative",
    border: `1px solid ${theme.palette.divider}`,
    justifyItems: "stretch",
    boxShadow: hasFeedback
      ? `0px 0px 20px 0px ${theme.palette.primary.main}`
      : "none",
    transition: "box-shadow 0.2s ease-in-out",
    width: "100%",
    maxWidth: horizontalRanking ? "520px" : "780px",
    justifySelf: "center",
    boxSizing: "border-box",
    paddingTop: isBestOfK && showBestOfKSelect ? "48px" : 0,
    gridTemplateColumns: horizontalRanking
      ? "1fr"
      : "auto auto minmax(340px, 560px)",
    gridTemplateRows: horizontalRanking
      ? "auto auto auto auto auto"
      : "auto auto auto",
    gridTemplateAreas: horizontalRanking
      ? `"envRender"
        "timelinechart"
        "mission"
        "evaluative"
        ${isBestOfK ? '"select"' : '"drag"'}`
      : `"drag envRender evaluative"
      "drag envRender timelinechart"
      "drag envRender mission"`,
  }),
);

const SelectButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: "8px",
  right: "10px",
  zIndex: 6,
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
  experimentId: number;
  environmentId: string;
  checkpoint?: number | string;
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

function sanitizeSubmitPayload(
  payload?: Record<string, any>,
): Record<string, any> {
  if (!payload || typeof payload !== "object") {
    return {};
  }

  // Guard against accidentally passing click/synthetic events as payload.
  if ("nativeEvent" in payload || "target" in payload || "currentTarget" in payload) {
    return {};
  }

  try {
    return JSON.parse(JSON.stringify(payload)) as Record<string, any>;
  } catch (_error) {
    return {};
  }
}

const EpisodeItem: React.FC<EpisodeItemProps> = ({
  episodeID,
  containerId,
  scheduleFeedback,
  selectBest,
  isSelectedAsBest,
  sessionId,
  evalFeedback,
  updateEvalFeedback,
  experimentId,
  environmentId,
  checkpoint,
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
  const [selectedStep, setSelectedStep] = useState(0);
  const [lockedCorrectionStep, setLockedCorrectionStep] = useState<number | null>(null);
  const [activePanel, setActivePanel] = useState<"none" | "demo" | "correction" | "feature">("none");
  const [demoSessionId, setDemoSessionId] = useState<string | null>(null);
  const [correctionSessionId, setCorrectionSessionId] = useState<string | null>(null);
  const [isSubmittingDemo, setIsSubmittingDemo] = useState(false);
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
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
  const canShowDemo = Boolean(UIConfig.feedbackComponents.demonstration);
  const canShowCorrection = Boolean(UIConfig.feedbackComponents.correction);
  const canShowFeatureSelection = Boolean(UIConfig.feedbackComponents.featureSelection);
  const normalizedCheckpoint = useMemo(() => {
    const numeric = Number(checkpoint);
    return Number.isFinite(numeric) ? numeric : undefined;
  }, [checkpoint]);

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
    let active = true;
    getUncertainty(episodeID).then((uncertaintyData) => {
      if (active) {
        setUncertainty(uncertaintyData ? uncertaintyData : []);
      }
    });
    return () => {
      active = false;
    };
  }, [episodeID, getUncertainty]);

  // Memoized callback handlers - prevents recreation on each render
  const onCorrectionModalOpenHandler = useCallback((step: number) => {
    if (!canShowCorrection) return;
    setSelectedStep(step);
    setLockedCorrectionStep(step);
    setCorrectionSessionId(
      `${sessionId}_correction_${episodeID}_${step}_${Date.now()}`,
    );
    setActivePanel("correction");
  }, [canShowCorrection, episodeID, sessionId]);

  const onFeatureSelectionSubmit = useCallback((feedback: Feedback) => {
    if (sessionId !== "-") {
      scheduleFeedback(feedback);
    }
  }, [scheduleFeedback, sessionId]);

  const onCorrectionDemoSubmit = useCallback(async (submitPayload?: Record<string, any>) => {
    if (!correctionSessionId) return;
    const correctionStep = lockedCorrectionStep ?? selectedStep;
    const safeSubmitPayload = sanitizeSubmitPayload(submitPayload);
    setIsSubmittingCorrection(true);
    try {
      const response = await axios.post("/demo_generation/save_webrtc_demo", {
        session_id: correctionSessionId,
        checkpoint: normalizedCheckpoint,
        ...safeSubmitPayload,
      });
      if (response.data?.success) {
        const correctionPath =
          response.data?.artifacts?.demo_file ?? response.data?.file_path ?? null;
        const feedback: Feedback = {
          feedback_type: FeedbackType.Corrective,
          targets: [
            {
              target_id: `state_${episodeID}_${correctionStep}`,
              reference: EpisodeFromID(episodeID || ""),
              origin: "online",
              timestamp: Date.now(),
              step: correctionStep,
            },
          ],
          granularity: "state",
          timestamp: Date.now(),
          session_id: sessionId,
          correction: `WebRTC correction for episode ${episodeID}, step ${correctionStep}`,
          correction_path: correctionPath,
        };
        setGivenFeedbackMarkers((prev) => [
          ...prev,
          { x: correctionStep, y: 1 },
        ]);
        if (sessionId !== "-") {
          scheduleFeedback(feedback);
        }
        setLockedCorrectionStep(null);
        setActivePanel("none");
      }
    } catch (error) {
      console.error("Failed to save correction demo:", error);
    } finally {
      setIsSubmittingCorrection(false);
    }
  }, [correctionSessionId, normalizedCheckpoint, episodeID, lockedCorrectionStep, selectedStep, scheduleFeedback, sessionId]);

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
  const shouldShowPanels = canShowDemo || canShowCorrection || canShowFeatureSelection;
  const showBestOfKSelect = isBestOfK && Boolean(UIConfig.feedbackComponents.ranking);

  const startDemoPanel = () => {
    if (!canShowDemo) return;
    setDemoSessionId(`${sessionId}_demo_${episodeID}_${Date.now()}`);
    setActivePanel("demo");
  };

  const startFeatureSelectionPanel = () => {
    if (!canShowFeatureSelection) return;
    setActivePanel("feature");
  };

  const closeActivePanel = () => {
    setActivePanel("none");
    setLockedCorrectionStep(null);
  };

  const onDemoSubmit = async (submitPayload?: Record<string, any>) => {
    if (!demoSessionId) return;
    const safeSubmitPayload = sanitizeSubmitPayload(submitPayload);
    setIsSubmittingDemo(true);
    try {
      const response = await axios.post("/demo_generation/save_webrtc_demo", {
        session_id: demoSessionId,
        checkpoint: normalizedCheckpoint,
        ...safeSubmitPayload,
      });
      if (response.data?.success) {
        const demoNumber = response.data?.demo_number ?? Date.now();
        const demoPath =
          response.data?.artifacts?.demo_file ?? response.data?.file_path ?? null;
        const feedback: Feedback = {
          feedback_type: FeedbackType.Demonstrative,
          targets: [
            {
              target_id: `${environmentId}_generated_-1-1${demoNumber}`,
              reference: {
                env_name: environmentId,
                benchmark_type: "generated",
                benchmark_id: -1,
                checkpoint_step: -1,
                episode_num: demoNumber,
              },
              origin: "generated",
              timestamp: Date.now(),
            },
          ],
          granularity: "episode",
          timestamp: Date.now(),
          session_id: sessionId,
          demonstration_path: demoPath,
        };
        if (sessionId !== "-") {
          scheduleFeedback(feedback);
        }
        setActivePanel("none");
      }
    } catch (error) {
      console.error("Failed to save demo:", error);
    } finally {
      setIsSubmittingDemo(false);
    }
  };

  const overlayContent = (() => {
    if (activePanel === "demo" && demoSessionId) {
      return (
        <WebRTCDemoComponent
          sessionId={demoSessionId}
          experimentId={String(experimentId)}
          environmentId={environmentId}
          checkpoint={normalizedCheckpoint}
          isSubmitting={isSubmittingDemo}
          onSubmit={onDemoSubmit}
          onCancel={closeActivePanel}
        />
      );
    }
    if (activePanel === "correction" && correctionSessionId) {
      const correctionStep = lockedCorrectionStep ?? selectedStep;
      return (
        <WebRTCDemoComponent
          sessionId={correctionSessionId}
          experimentId={String(experimentId)}
          environmentId={environmentId}
          checkpoint={normalizedCheckpoint}
          episodeNum={EpisodeFromID(episodeID || "").episode_num}
          step={correctionStep}
          isSubmitting={isSubmittingCorrection}
          onSubmit={onCorrectionDemoSubmit}
          onCancel={closeActivePanel}
        />
      );
    }
    if (activePanel === "feature") {
      return (
        <Box
          sx={{
            height: "100%",
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box sx={{ position: "relative", width: 360, height: 360, maxWidth: "100%" }}>
            <FeatureHighlightModal
              episodeId={episodeID}
              getThumbnailURL={getThumbnailURL}
              onClose={closeActivePanel}
              onCloseSubmit={onFeatureSelectionSubmit}
              sessionId={sessionId}
            />
          </Box>
        </Box>
      );
    }
    return null;
  })();

  const toolControls = shouldShowPanels ? (
    <Box
      sx={{
        display: "flex",
        gap: 0.5,
        p: 0.5,
        borderRadius: 1,
        backgroundColor: "rgba(0,0,0,0.45)",
      }}
    >
      {activePanel === "none" ? (
        <>
          {canShowDemo && (
            <Button variant="contained" size="small" onClick={startDemoPanel}>
              Demo
            </Button>
          )}
          {canShowCorrection && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => onCorrectionModalOpenHandler(lockedCorrectionStep ?? selectedStep)}
              sx={{ color: "white", borderColor: "rgba(255,255,255,0.6)" }}
            >
              Correct @ {lockedCorrectionStep ?? selectedStep}
            </Button>
          )}
          {canShowFeatureSelection && (
            <Button
              variant="outlined"
              size="small"
              onClick={startFeatureSelectionPanel}
              sx={{ color: "white", borderColor: "rgba(255,255,255,0.6)" }}
            >
              Annotate
            </Button>
          )}
        </>
      ) : (
        <Button
          size="small"
          variant="outlined"
          onClick={closeActivePanel}
          sx={{ color: "white", borderColor: "rgba(255,255,255,0.6)" }}
        >
          Close
        </Button>
      )}
    </Box>
  ) : null;

  const EpisodeContent = (
    <EpisodeItemContainer
      horizontalRanking={UIConfig.uiComponents.horizontalRanking}
      isDragging={isBestOfK ? false : isDragging}
      hasFeedback={false}
      isBestOfK={isBestOfK}
      showBestOfKSelect={showBestOfKSelect}
    >
      {!isBestOfK && (
        <DragHandle
          horizontalRanking={UIConfig.uiComponents.horizontalRanking}
          {...dragHandleProps}
        />
      )}

      {showBestOfKSelect && (
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
        showFeatureSelection={canShowFeatureSelection}
        onFeatureSelect={startFeatureSelectionPanel}
        useCorrectiveFeedback={canShowCorrection}
        videoRef={videoRef}
        toolControls={toolControls}
        overlayContent={overlayContent}
        onPlaybackStepChange={(step) => {
          if (lockedCorrectionStep === null && !isSubmittingCorrection) {
            setSelectedStep(step);
          }
        }}
        timelineInteractionLocked={lockedCorrectionStep !== null || isSubmittingCorrection}
        correctionStep={lockedCorrectionStep}
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
