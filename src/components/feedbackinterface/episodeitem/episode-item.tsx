import React, { useRef, useEffect, useState, useMemo, useCallback } from "react";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// MUI
import chroma from "chroma-js";
// Axios
import axios from "axios";
import { styled } from "@mui/system";
import { useTheme } from "@mui/material/styles";
import {
  Box,
  Button,
  IconButton,
  Slider,
  Typography,
} from "@mui/material";
import { Check, ThumbDown, ThumbUp } from "@mui/icons-material";

// Components
import VideoPlaybackContainer from "./video-playback-container";
import DragHandle from "./drag-handle";
import EvaluativeFeedback from "./evaluative-feedback";
import TextFeedback from "./text-feedback";
import FeatureHighlightModal from "../feature-highlight-modal";
import WebRTCDemoComponent from "../../../active_learning/WebRTCDemoComponent";

// Types and Context
import { EpisodeFromID, IDfromEpisode } from "../../../id";
import { Episode, Feedback, FeedbackType } from "../../../types";
import { useAppState } from "../../../AppStateContext";
import { useSetupConfigState } from "../../../SetupConfigContext";
import { useGetter } from "../../../getter-context";
import { useRatingInfo } from "../../../rating-info-context";
import { getTrajectoryDisplayLimit } from "../../../trajectoryDisplayLimit";
import { postCached } from "../../../utils/cachedPostRequests";

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
    maxWidth: horizontalRanking
      ? "clamp(560px, 32vw, 760px)"
      : "clamp(840px, 58vw, 1240px)",
    justifySelf: "center",
    boxSizing: "border-box",
    paddingTop: isBestOfK && showBestOfKSelect ? "48px" : 0,
    gridTemplateColumns: horizontalRanking
      ? "1fr"
      : "auto auto minmax(clamp(380px, 24vw, 520px), clamp(620px, 42vw, 900px))",
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

type ClusterStateRef = {
  episode: Episode;
  step: number;
  globalIndex: number;
};

type ClusterDefinition = {
  label: string;
  states: ClusterStateRef[];
};

const MAX_TRAJECTORIES_PER_CHECKPOINT = getTrajectoryDisplayLimit();

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
  const theme = useTheme();

  const videoRef = useRef<HTMLVideoElement>(document.createElement("video"));
  const [videoURL, setVideoURL] = useState("");
  const [thumbnailURL, setThumbnailURL] = useState("");
  const [staticFrameURL, setStaticFrameURL] = useState("");
  const [staticFrameAspectRatio, setStaticFrameAspectRatio] = useState(4 / 3);
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
  const [localDemoSubmitted, setLocalDemoSubmitted] = useState(false);
  const [givenFeedbackMarkers, setGivenFeedbackMarkers] = useState<any[]>([]);
  const [proposedFeedbackMarkers, setProposedFeedbackMarkers] = useState<
    any[]
  >([]);
  const [clusterSliderValue, setClusterSliderValue] = useState(5);
  const [clusterFrameImages, setClusterFrameImages] = useState<string[]>([]);
  const [clusterSampledIndices, setClusterSampledIndices] = useState<number[]>([]);
  const [clusterSampledCaptions, setClusterSampledCaptions] = useState<string[]>([]);
  const [clusterCatalog, setClusterCatalog] = useState<ClusterDefinition[]>([]);
  const [stepDetails, setStepDetails] = useState<StepDetails>({
    action_distribution: [],
    action: 0,
    reward: 0,
    info: {},
    action_space: {},
  });

  // Hooks
  const appState = useAppState();
  const setupState = useSetupConfigState();
  const UIConfig = setupState.activeUIConfig;
  const uiConfigSequence = setupState.uiConfigSequence;
  const { hasFeedback } = useRatingInfo();
  const { getThumbnailURL, getVideoURL, getRewards, getUncertainty } = useGetter();
  const canShowDemo = Boolean(UIConfig.feedbackComponents.demonstration);
  const canShowCorrection = Boolean(UIConfig.feedbackComponents.correction);
  const canShowFeatureSelection = Boolean(UIConfig.feedbackComponents.featureSelection);
  const canShowClusterRating = Boolean(UIConfig.feedbackComponents.clusterRating);
  const normalizedCheckpoint = useMemo(() => {
    const numeric = Number(checkpoint);
    return Number.isFinite(numeric) ? numeric : undefined;
  }, [checkpoint]);
  const episodeReference = useMemo(
    () => EpisodeFromID(episodeID || ""),
    [episodeID],
  );
  const checkpointEpisodes = useMemo(
    () => {
      const matchingEpisodes = appState.episodeIDsChronologically.filter(
        (episode) =>
          episode.checkpoint_step === episodeReference.checkpoint_step &&
          episode.benchmark_id === episodeReference.benchmark_id &&
          episode.env_name === episodeReference.env_name,
      );

      if (!Number.isFinite(MAX_TRAJECTORIES_PER_CHECKPOINT)) {
        return matchingEpisodes;
      }
      return matchingEpisodes.slice(0, MAX_TRAJECTORIES_PER_CHECKPOINT);
    },
    [
      appState.episodeIDsChronologically,
      episodeReference.benchmark_id,
      episodeReference.checkpoint_step,
      episodeReference.env_name,
    ],
  );
  const clusterPhaseIndex = useMemo(() => {
    if (!canShowClusterRating || !uiConfigSequence.length) {
      return 0;
    }
    let seen = 0;
    for (let index = 0; index <= appState.currentStep && index < uiConfigSequence.length; index += 1) {
      if (uiConfigSequence[index]?.uiConfig?.id === UIConfig.id) {
        seen += 1;
      }
    }
    return Math.max(0, seen - 1);
  }, [
    UIConfig.id,
    appState.currentStep,
    canShowClusterRating,
    uiConfigSequence,
  ]);
  const activeCluster = useMemo(() => {
    if (!canShowClusterRating || clusterCatalog.length === 0) {
      return null;
    }
    if (clusterPhaseIndex >= clusterCatalog.length) {
      return null;
    }
    return clusterCatalog[clusterPhaseIndex];
  }, [canShowClusterRating, clusterCatalog, clusterPhaseIndex]);

  // Feedback status checks - memoized to prevent recalculation on every render
  const feedbackStatus = useMemo(() => ({
    hasComparativeFeedback: hasFeedback(
      EpisodeFromID(episodeID),
      FeedbackType.Comparative,
    ),
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
    hasClusterRatingFeedback: hasFeedback(
      EpisodeFromID(episodeID),
      FeedbackType.ClusterRating,
    ),
    hasDemoFeedback: hasFeedback(
      EpisodeFromID(episodeID),
      FeedbackType.Demonstrative,
    ),
  }), [episodeID, hasFeedback]);

  const shouldHighlightComparativeFeedback =
    (Boolean(UIConfig.feedbackComponents.ranking) ||
      Boolean(UIConfig.feedbackComponents.comparison)) &&
    feedbackStatus.hasComparativeFeedback;
  const shouldHighlightDemoFeedback =
    canShowDemo && (feedbackStatus.hasDemoFeedback || localDemoSubmitted);
  const shouldHighlightCorrectiveFeedback =
    canShowCorrection && feedbackStatus.hasCorrectiveFeedback;
  const hasInteractionFeedbackHighlight =
    shouldHighlightComparativeFeedback ||
    shouldHighlightDemoFeedback ||
    shouldHighlightCorrectiveFeedback;

  // Data fetching - using useEffect with proper dependencies
  useEffect(() => {
    getVideoURL(episodeID).then((url) => {
      setVideoURL(url || "");
    });
  }, [episodeID, getVideoURL]);

  useEffect(() => {
    getThumbnailURL(episodeID).then((url) => {
      setThumbnailURL(url || "");
    });
  }, [episodeID, getThumbnailURL]);

  useEffect(() => {
    if (canShowClusterRating) {
      return;
    }
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
  }, [canShowClusterRating, episodeID]);

  useEffect(() => {
    if (canShowClusterRating) {
      setActions([]);
      return;
    }
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
  }, [canShowClusterRating, episodeID]);

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

  useEffect(() => {
    if (!canShowClusterRating) {
      setClusterFrameImages([]);
      setClusterSampledIndices([]);
      setClusterSampledCaptions([]);
      setClusterCatalog([]);
      return;
    }

    const buildFallbackCatalog = (): ClusterDefinition[] => {
      const totalSteps = Math.max(rewards.length, 1);
      const states = Array.from({ length: totalSteps }, (_, step) => ({
        episode: episodeReference,
        step,
        globalIndex: step,
      }));
      return [
        {
          label: `episode_${episodeReference.episode_num}_full`,
          states,
        },
      ];
    };

    if (!checkpointEpisodes.length) {
      setClusterCatalog(buildFallbackCatalog());
      return;
    }

    let active = true;
    postCached("/projection/generate_projection", null, {
        params: {
          env_name: episodeReference.env_name,
          benchmark_id: episodeReference.benchmark_id,
          checkpoint_step: episodeReference.checkpoint_step,
          projection_method: "PCA",
          sequence_length: 1,
        },
      })
      .then((response) => {
        if (!active) {
          return;
        }
        const payload = response.data as {
          labels?: unknown[];
          episode_indices?: unknown[];
        };
        const rawLabels = Array.isArray(payload.labels) ? payload.labels : [];
        const rawEpisodeIndices = Array.isArray(payload.episode_indices)
          ? payload.episode_indices
          : [];
        const totalPoints = Math.min(rawLabels.length, rawEpisodeIndices.length);
        if (totalPoints <= 0) {
          setClusterCatalog(buildFallbackCatalog());
          return;
        }

        const stepCounterPerEpisode = new Map<number, number>();
        const clusterMap = new Map<string, ClusterStateRef[]>();

        for (let i = 0; i < totalPoints; i += 1) {
          const episodeIndex = Number(rawEpisodeIndices[i]);
          if (
            !Number.isFinite(episodeIndex) ||
            episodeIndex < 0 ||
            episodeIndex >= checkpointEpisodes.length
          ) {
            continue;
          }
          const safeEpisodeIndex = Math.floor(episodeIndex);
          const episode = checkpointEpisodes[safeEpisodeIndex];
          if (!episode) {
            continue;
          }

          const currentStep = stepCounterPerEpisode.get(safeEpisodeIndex) ?? 0;
          stepCounterPerEpisode.set(safeEpisodeIndex, currentStep + 1);

          const labelEntry = rawLabels[i];
          const rawLabel = Array.isArray(labelEntry) ? labelEntry[0] : labelEntry;
          const label = `cluster_${String(rawLabel)}`;
          const clusterStates = clusterMap.get(label) ?? [];
          clusterStates.push({
            episode,
            step: currentStep,
            globalIndex: i,
          });
          clusterMap.set(label, clusterStates);
        }

        const parsedClusters: ClusterDefinition[] = Array.from(clusterMap.entries())
          .map(([label, states]) => ({
            label,
            states,
          }))
          .filter((cluster) => cluster.states.length > 0)
          .sort((left, right) => {
            const leftNumeric = Number(left.label.replace("cluster_", ""));
            const rightNumeric = Number(right.label.replace("cluster_", ""));
            if (Number.isFinite(leftNumeric) && Number.isFinite(rightNumeric)) {
              return leftNumeric - rightNumeric;
            }
            return left.label.localeCompare(right.label);
          });

        setClusterCatalog(parsedClusters.length > 0 ? parsedClusters : buildFallbackCatalog());
      })
      .catch(() => {
        if (active) {
          setClusterCatalog(buildFallbackCatalog());
        }
      });

    return () => {
      active = false;
    };
  }, [canShowClusterRating, checkpointEpisodes, episodeReference, rewards.length]);

  useEffect(() => {
    if (!canShowClusterRating || !activeCluster || activeCluster.states.length === 0) {
      setClusterFrameImages([]);
      setClusterSampledIndices([]);
      setClusterSampledCaptions([]);
      return;
    }

    const clusterStates = activeCluster.states;
    const sampleCount = Math.min(clusterStates.length, 9);
    const sampledStates =
      sampleCount <= 1
        ? [clusterStates[0]]
        : Array.from({ length: sampleCount }, (_, i) => {
            const index = Math.round((i / (sampleCount - 1)) * (clusterStates.length - 1));
            return clusterStates[index];
          });

    const sampledIndices = sampledStates.map((stateRef) => stateRef.step);
    setClusterSampledIndices(sampledIndices);
    setClusterSampledCaptions(
      sampledStates.map(
        (stateRef) => `E${stateRef.episode.episode_num} • S${stateRef.step}`,
      ),
    );

    fetch("/data/get_cluster_frames", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cluster_indices: sampledStates.map((stateRef) => stateRef.step),
        episode_data: sampledStates.map((stateRef) => stateRef.episode),
        max_states_to_show: 9,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch cluster frames");
        }
        return response.json();
      })
      .then((images: string[]) => {
        setClusterFrameImages(images);
      })
      .catch(() => {
        setClusterFrameImages([]);
      });
  }, [activeCluster, canShowClusterRating]);

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
  const shouldShowPanels =
    !canShowClusterRating &&
    (canShowDemo || canShowCorrection || canShowFeatureSelection);
  const showStaticDemoReference =
    canShowDemo &&
    !canShowCorrection &&
    !canShowFeatureSelection &&
    !canShowClusterRating;
  const showBestOfKSelect = isBestOfK && Boolean(UIConfig.feedbackComponents.ranking);

  useEffect(() => {
    let active = true;

    if (!showStaticDemoReference) {
      setStaticFrameURL("");
      setStaticFrameAspectRatio(4 / 3);
      return () => {
        active = false;
      };
    }

    fetch("/data/get_cluster_frames", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cluster_indices: [0],
        episode_data: [episodeReference],
        max_states_to_show: 1,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch initial frame");
        }
        const images = (await response.json()) as string[];
        return images[0] ?? "";
      })
      .then((frameUrl) => {
        if (!active) return;
        if (frameUrl) {
          setStaticFrameURL(frameUrl);
          return;
        }
        setStaticFrameURL(thumbnailURL || "");
      })
      .catch(() => {
        if (active) {
          setStaticFrameURL(thumbnailURL || "");
        }
      });

    return () => {
      active = false;
    };
  }, [episodeReference, showStaticDemoReference, thumbnailURL]);

  useEffect(() => {
    setLocalDemoSubmitted(false);
  }, [episodeID]);

  const startDemoPanel = () => {
    if (!canShowDemo) return;
    setDemoSessionId(`${sessionId}_demo_${episodeID}_${Date.now()}`);
    setActivePanel("demo");
  };

  const startFeatureSelectionPanel = () => {
    if (!canShowFeatureSelection) return;
    setActivePanel("feature");
  };

  const submitClusterRating = useCallback((
    _: Event | React.SyntheticEvent<Element, Event>,
    value: number | number[],
  ) => {
    const numericValue = Array.isArray(value) ? value[0] : value;
    const score = Math.max(0, Math.min(10, Math.round(Number(numericValue))));
    if (!Number.isFinite(score)) {
      return;
    }
    if (!activeCluster || activeCluster.states.length === 0) {
      return;
    }

    const groupedByEpisode = new Map<string, { episode: Episode; steps: number[] }>();
    for (const stateRef of activeCluster.states) {
      const episodeKey = IDfromEpisode(stateRef.episode);
      const current = groupedByEpisode.get(episodeKey);
      if (current) {
        current.steps.push(stateRef.step);
      } else {
        groupedByEpisode.set(episodeKey, {
          episode: stateRef.episode,
          steps: [stateRef.step],
        });
      }
    }

    const timestamp = Date.now();
    const targets: Feedback["targets"] = [];
    for (const [episodeKey, grouped] of groupedByEpisode.entries()) {
      const sortedSteps = Array.from(new Set(grouped.steps)).sort((left, right) => left - right);
      if (!sortedSteps.length) {
        continue;
      }

      let segmentStart = sortedSteps[0];
      let previousStep = sortedSteps[0];
      for (let i = 1; i < sortedSteps.length; i += 1) {
        const step = sortedSteps[i];
        if (step === previousStep + 1) {
          previousStep = step;
          continue;
        }
        targets.push({
          target_id: episodeKey,
          reference: grouped.episode,
          origin: "online",
          timestamp,
          start: segmentStart,
          end: previousStep,
        });
        segmentStart = step;
        previousStep = step;
      }

      targets.push({
        target_id: episodeKey,
        reference: grouped.episode,
        origin: "online",
        timestamp,
        start: segmentStart,
        end: previousStep,
      });
    }

    if (!targets.length) {
      return;
    }

    const feedback: Feedback = {
      feedback_type: FeedbackType.ClusterRating,
      targets,
      granularity: "segment",
      timestamp,
      session_id: sessionId,
      score,
      cluster_label: activeCluster.label,
    };

    setClusterSliderValue(score);
    if (sessionId !== "-") {
      scheduleFeedback(feedback);
    }
  }, [activeCluster, scheduleFeedback, sessionId]);

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
        const sourceEpisodeReference = EpisodeFromID(episodeID || "");
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
            {
              target_id: episodeID,
              reference: sourceEpisodeReference,
              origin: "offline",
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
        setLocalDemoSubmitted(true);
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
      const demoReferenceEpisode = EpisodeFromID(episodeID || "");
      return (
        <WebRTCDemoComponent
          sessionId={demoSessionId}
          experimentId={String(experimentId)}
          environmentId={environmentId}
          checkpoint={normalizedCheckpoint}
          episodeNum={demoReferenceEpisode.episode_num}
          step={0}
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
              {showStaticDemoReference ? "Start Demo" : "Demo"}
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
      hasFeedback={hasInteractionFeedbackHighlight}
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
      {canShowClusterRating ? (
        <Box
          sx={{
            gridArea: "envRender",
            justifySelf: "center",
            alignSelf: "center",
            width: "100%",
            maxWidth: "clamp(600px, 36vw, 900px)",
            minHeight: UIConfig.uiComponents.horizontalRanking
              ? "clamp(520px, 52vh, 680px)"
              : "clamp(600px, 60vh, 760px)",
            marginTop: "1rem",
            border: (theme) => `1px solid ${theme.palette.divider}`,
            borderRadius: "10px",
            overflow: "hidden",
            boxShadow: feedbackStatus.hasClusterRatingFeedback
              ? (theme) => `0px 0px 20px 0px ${theme.palette.primary.main}`
              : "none",
          }}
        >
          <Box sx={{ p: 1.25 }}>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 1,
                mb: 1.5,
              }}
            >
              {clusterSampledIndices.map((sampledStep, index) => (
                <Box
                  key={`cluster-frame-${episodeID}-${sampledStep}-${index}`}
                  sx={{
                    borderRadius: 1,
                    overflow: "hidden",
                    border: (theme) => `1px solid ${theme.palette.divider}`,
                    backgroundColor: "background.default",
                  }}
                >
                  {clusterFrameImages[index] ? (
                    <Box
                      component="img"
                      src={clusterFrameImages[index]}
                      alt={`Cluster step ${sampledStep}`}
                      sx={{
                        width: "100%",
                        height: "clamp(120px, 12vh, 160px)",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        width: "100%",
                        height: "clamp(120px, 12vh, 160px)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "text.secondary",
                        fontSize: 12,
                      }}
                    >
                      No frame
                    </Box>
                  )}
                  <Typography
                    variant="caption"
                    sx={{ display: "block", textAlign: "center", py: 0.25 }}
                  >
                    {clusterSampledCaptions[index] ?? `Step ${sampledStep}`}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: "auto 1fr auto",
                alignItems: "center",
                columnGap: 1,
              }}
            >
              <ThumbDown
                sx={{
                  color: theme.palette.text.secondary,
                  "&:hover": {
                    color: theme.palette.primary.main,
                  },
                }}
                onClick={() => setClusterSliderValue((value) => Math.max(0, value - 1))}
              />
              <Box sx={{ position: "relative", pt: 0.25, pb: 1.2 }}>
                <Slider
                  step={1}
                  min={0}
                  max={10}
                  value={clusterSliderValue}
                  valueLabelDisplay="auto"
                  marks
                  sx={{
                    color: chroma
                      .mix(
                        theme.palette.primary.main,
                        theme.palette.text.secondary,
                        1.0 - (clusterSliderValue + 1) / 10,
                      )
                      .hex(),
                  }}
                  onChange={(_, value) => setClusterSliderValue(value as number)}
                  onChangeCommitted={submitClusterRating}
                />
                <Box
                  sx={{
                    position: "absolute",
                    left: "calc(50% - 2px)",
                    transform: "translateX(-50%)",
                    top: "calc(100% - 13px)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    pointerEvents: "none",
                    opacity: 0.68,
                  }}
                >
                  <Box
                    sx={{
                      width: "1px",
                      height: "5px",
                      bgcolor: "text.secondary",
                    }}
                  />
                  <Box
                    component="span"
                    sx={{
                      mt: 0,
                      fontSize: "0.65rem",
                      color: "text.secondary",
                      letterSpacing: "0.03em",
                    }}
                  >
                    neutral
                  </Box>
                </Box>
              </Box>
              <ThumbUp
                sx={{
                  color: theme.palette.primary.main,
                }}
                onClick={() => setClusterSliderValue((value) => Math.min(10, value + 1))}
              />
            </Box>
          </Box>
        </Box>
      ) : showStaticDemoReference ? (
        <Box
          sx={{
            gridArea: "envRender",
            justifySelf: "center",
            alignSelf: "center",
            width: "100%",
            marginTop: "1rem",
            border: (theme) => `1px solid ${theme.palette.divider}`,
            borderRadius: "10px",
            overflow: "hidden",
            position: "relative",
            bgcolor: "background.paper",
          }}
        >
          {stepDetails?.info?.mission && (
            <Box
              sx={{
                padding: "4px 8px",
                borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
                bgcolor: (theme) => theme.palette.background.default,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  fontSize: "0.8rem",
                  lineHeight: 1.2,
                }}
              >
                Task: {stepDetails.info.mission}
              </Typography>
            </Box>
          )}
          <Box
            sx={{
              position: "relative",
              width: "min(calc(100% - 16px), 33vw)",
              minWidth: 260,
              maxWidth: "100%",
              aspectRatio: `${staticFrameAspectRatio}`,
              maxHeight: "56vh",
              boxSizing: "border-box",
              mx: "auto",
              my: 1,
              p: 0.5,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "background.default",
              overflow: "hidden",
            }}
          >
            {staticFrameURL ? (
              <Box
                component="img"
                src={staticFrameURL}
                alt={`Initial frame for episode ${episodeID}`}
                onLoad={(event: React.SyntheticEvent<HTMLImageElement>) => {
                  const image = event.currentTarget;
                  if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                    setStaticFrameAspectRatio(image.naturalWidth / image.naturalHeight);
                  }
                }}
                sx={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            ) : (
              <Typography variant="body2" color="text.secondary">
                Loading initial frame...
              </Typography>
            )}

            {toolControls && (
              <Box
                sx={{
                  position: "absolute",
                  top: "4px",
                  right: "4px",
                  zIndex: 4,
                }}
              >
                {toolControls}
              </Box>
            )}

            {overlayContent && (
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 3,
                  display: "flex",
                  flexDirection: "column",
                  backgroundColor: "rgba(0, 0, 0, 0.25)",
                }}
              >
                {overlayContent}
              </Box>
            )}
          </Box>
        </Box>
      ) : (
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
          hasCorrectiveFeedback={false}
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
      )}

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
