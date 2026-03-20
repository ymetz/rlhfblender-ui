// FeedbackInterface.tsx
import React, {
  useState,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Box, Chip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { RatingInfoContext } from "../rating-info-context";
import { useAppDispatch, useAppState } from "../AppStateContext";
import { useSetupConfigState } from "../SetupConfigContext";
import { EpisodeFromID, IDfromEpisode } from "../id";
import { Episode, Feedback, FeedbackType } from "../types";

import { DroppableColumnContainer } from "./feedbackinterface/styles";
import { useFeedbackState } from "./feedbackinterface/hooks/useFeedbackState";
import { useConfigBasedSampling } from "../episodeSamplingWithSequence";
import { useFeedbackSubmission } from "./feedbackinterface/hooks/useFeedbackSubmission";
import { ProgressHeader } from "./feedbackinterface/progress-header";
import DroppableColumn from "./feedbackinterface/droppable-column";
import BestOfKColumn from "./feedbackinterface/best-of-k-column";
import ScrollableEpisodeList from "./feedbackinterface/scrollable-episode-list";
import { useFeedbackShortcuts } from "./feedbackinterface/hooks/useShortcuts";

// Add new type for feedback mode
type FeedbackMode = "ranking" | "bestOfK" | "annotation";

const FeedbackInterface: React.FC = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const configState = useSetupConfigState();
  const theme = useTheme();

  const {
    currentStep,
    episodeIDsChronologically,
    rankeableEpisodeIDs,
    selectedExperiment,
    selectedCheckpoint,
    actionLabels,
    sessionId,
    scheduledFeedback,
  } = state;
  const { activeUIConfig, uiConfigSequence } = useSetupConfigState();

  const [isOnSubmit, setIsOnSubmit] = useState(false);
  const [evalFeedback, setEvalFeedback] = useState({});

  // Determine feedback mode based on UI config
  const feedbackMode: FeedbackMode = activeUIConfig.uiComponents.bestOfK
    ? "bestOfK"
    : "ranking";
  const horizontalDrag =
    activeUIConfig.uiComponents.horizontalRanking && feedbackMode === "ranking";
  const checkpointProgress = useMemo(() => {
    const checkpoints = selectedExperiment?.checkpoint_list ?? [];
    const total = checkpoints.length;
    if (total === 0) {
      return { current: 0, total: 0 };
    }

    const numericSelectedCheckpoint = Number(selectedCheckpoint);
    let index = Number.isFinite(numericSelectedCheckpoint)
      ? checkpoints.findIndex((checkpoint) => Number(checkpoint) === numericSelectedCheckpoint)
      : -1;
    if (index < 0) {
      index = checkpoints.findIndex(
        (checkpoint) => String(checkpoint) === String(selectedCheckpoint),
      );
    }
    if (index < 0) {
      index = 0;
    }

    return { current: index + 1, total };
  }, [selectedCheckpoint, selectedExperiment?.checkpoint_list]);
  const showCheckpointProgress =
    state.app_mode === "study" && checkpointProgress.total > 1;

  const { columnOrder, setColumnOrder, ranks, setRanks } =
    useFeedbackState(rankeableEpisodeIDs);
  const { sampleEpisodes, advanceToNextStep } = useConfigBasedSampling();
  const { scheduleFeedback, submitFeedback } = useFeedbackSubmission(
    sampleEpisodes,
    advanceToNextStep,
  );
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

  // Handle best-of-k selection
  const handleBestOfKSelection = (selectedEpisodeId: string) => {
    const feedback: Feedback = {
      feedback_type: FeedbackType.Comparative,
      timestamp: Date.now(),
      session_id: sessionId,
      targets: rankeableEpisodeIDs.map((episodeId) => ({
        target_id: episodeId,
        reference: EpisodeFromID(episodeId),
        origin: "offline",
        timestamp: Date.now(),
      })),
      preferences: rankeableEpisodeIDs.map((episodeId) =>
        episodeId === selectedEpisodeId ? 1 : 0,
      ),
      granularity: "episode",
    };

    setSelectedColumn(selectedEpisodeId);
    scheduleFeedback(feedback);
  };

  const updateEvalFeedback = (episodeId: string, newRating: number) => {
    setEvalFeedback((prevRatings) => ({
      ...prevRatings,
      [episodeId]: newRating,
    }));
  };

  const isInitialized = useRef(false);
  const resetDispatchRef = useRef(false);

  const resetInitialization = useMemo(() => {
    return () => {
      isInitialized.current = false;
    };
  }, []);

  useEffect(() => {
    if (!resetDispatchRef.current) {
      dispatch({
        type: "SET_FEEDBACK_INTERFACE_RESET",
        payload: resetInitialization,
      });
      resetDispatchRef.current = true;
    }
  }, []);

  useEffect(() => {
    // Only run initial sampling once when conditions are met
    if (
      !isInitialized.current &&
      episodeIDsChronologically.length > 0 &&
      uiConfigSequence.length > 0
    ) {
      isInitialized.current = true;
      sampleEpisodes(0); // Start with step 0
      setSelectedColumn(null);
    }
  }, [episodeIDsChronologically, sampleEpisodes, uiConfigSequence]);

  useEffect(() => {
    // Ensure best-of-k selection UI resets when moving to a new sampled step
    // even if one episode ID remains the same between consecutive batches.
    setSelectedColumn(null);
  }, [currentStep, activeUIConfig.id, rankeableEpisodeIDs]);

  const handleSubmitFeedback = useCallback(async () => {
    const hasNextStep = await submitFeedback(scheduledFeedback, state.sessionId);
    if (hasNextStep) {
      setSelectedColumn(null);
    }
  }, [scheduledFeedback, state.sessionId, submitFeedback]);

  const sensors = useSensors(useSensor(PointerSensor));

  const findContainerForId = useCallback(
    (id: string) => {
      if (id === "scrollable-episode-list") {
        return "scrollable-episode-list";
      }

      for (const rankId of columnOrder) {
        if (ranks[rankId]?.episodeItemIDs.includes(id)) {
          return rankId;
        }
      }

      return undefined;
    },
    [columnOrder, ranks],
  );

  // Define onDragEnd function
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over) {
      return;
    }

    const rawActiveId = String(active.id);
    const activeId = rawActiveId.endsWith("_duplicate")
      ? rawActiveId.replace(/_duplicate$/, "")
      : rawActiveId;

    const overId = String(over.id);

    const srcContainer =
      active.data.current?.sortable?.containerId ??
      active.data.current?.containerId ??
      findContainerForId(activeId);
    const destContainer =
      over.data.current?.sortable?.containerId ??
      over.data.current?.containerId ??
      findContainerForId(overId) ??
      overId;

    if (!srcContainer || !destContainer) {
      return;
    }

    if (destContainer === "scrollable-episode-list") {
      return;
    }

    if (srcContainer === destContainer && activeId === overId) {
      return;
    }

    const destItems = Array.from(ranks[destContainer].episodeItemIDs);
    const destIndex =
      over.data.current?.sortable?.index ?? destItems.length;

    const newRankeableEpisodeIDs: string[] = Array.from(rankeableEpisodeIDs);
    if (srcContainer === "scrollable-episode-list") {
      if (!newRankeableEpisodeIDs.includes(activeId)) {
        newRankeableEpisodeIDs.push(activeId);
      }
    }

    let newState: {
      rankeableEpisodeIDs: string[];
      ranks: {
        [key: string]: {
          rank: number;
          title: string;
          episodeItemIDs: string[];
        };
      };
      columnOrder: string[];
    };

    if (srcContainer === destContainer) {
      const oldIndex = destItems.indexOf(activeId);
      if (oldIndex === -1) {
        return;
      }

      const newEpisodeItemIDs = arrayMove(destItems, oldIndex, destIndex);
      const newRank = {
        ...ranks[destContainer],
        episodeItemIDs: newEpisodeItemIDs,
      };

      newState = {
        rankeableEpisodeIDs: newRankeableEpisodeIDs,
        ranks: {
          ...ranks,
          [destContainer]: newRank,
        },
        columnOrder: columnOrder,
      };
    } else {
      const newDestDraggableIDs = Array.from(destItems);
      newDestDraggableIDs.splice(destIndex, 0, activeId);

      const destKey = destContainer as keyof typeof ranks;
      const newRanks: typeof ranks = {
        ...ranks,
        [destKey]: {
          ...ranks[destKey],
          episodeItemIDs: newDestDraggableIDs,
        },
      };

      if (srcContainer !== "scrollable-episode-list") {
        const srcItems = Array.from(ranks[srcContainer].episodeItemIDs);
        const srcIndex = srcItems.indexOf(activeId);
        if (srcIndex !== -1) {
          srcItems.splice(srcIndex, 1);
        }
        const srcKey = srcContainer as keyof typeof ranks;
        newRanks[srcKey] = {
          ...ranks[srcKey],
          episodeItemIDs: srcItems,
        };
      }

      newState = {
        ranks: newRanks,
        rankeableEpisodeIDs: newRankeableEpisodeIDs,
        columnOrder: columnOrder,
      };
    }

    // Update local state
    setRanks(newState.ranks);
    setColumnOrder(newState.columnOrder);

    // Prepare feedback data
    const orderedEpisodes: { id: string; reference: Episode }[] = [];
    const orderedRanks: number[] = [];
    for (const rank of newState.columnOrder) {
      const rankObject = newState.ranks[rank];

      for (const episodeID of rankObject.episodeItemIDs) {
        orderedEpisodes.push({
          id: episodeID,
          reference: EpisodeFromID(episodeID),
        });
        orderedRanks.push(rankObject.rank);
      }
    }

    // Log current order as feedback
    const feedback: Feedback = {
      feedback_type: FeedbackType.Comparative,
      timestamp: Date.now(),
      session_id: sessionId,
      targets: orderedEpisodes.map((e) => ({
        target_id: e.id,
        reference: e.reference,
        origin: "offline",
        timestamp: Date.now(),
      })),
      preferences: orderedRanks,
      granularity: "episode",
    };

    // Schedule the feedback
    scheduleFeedback(feedback);
  };

  const hasFeedback = useCallback(
    (episode: Episode, feedbackType: FeedbackType) => {
      const episodeId = IDfromEpisode(episode);
      return scheduledFeedback.some(
        (feedback) =>
          feedback.feedback_type === feedbackType &&
          feedback.targets?.some(
            (target) =>
              target.target_id === episodeId ||
              (target.reference !== undefined &&
                IDfromEpisode(target.reference as Episode) === episodeId),
          ),
      );
    },
    [scheduledFeedback],
  );

  const ratingInfoValue = useMemo(
    () => ({
      isOnSubmit,
      hasFeedback,
    }),
    [isOnSubmit, hasFeedback],
  );

  // Feedback shortcuts

  const handleFeatureAnnotation = useCallback((episodeId: string) => {
    console.log("Feature annotation for episode", episodeId);
  }, []);

  const { handleEpisodeHover, hoveredEpisodeId } = useFeedbackShortcuts({
    episodeIDs: rankeableEpisodeIDs,
    feedbackMode,
    onEvalFeedback: updateEvalFeedback,
    onBestOfKSelection: handleBestOfKSelection,
    onDemoRequest: undefined,
    onFeatureAnnotation: handleFeatureAnnotation,
    uiConfigFeedbackComponents: activeUIConfig.feedbackComponents,
  });

  return (
    <RatingInfoContext.Provider value={ratingInfoValue}>
      <ProgressHeader
        showProgressBar={activeUIConfig.uiComponents.progressBar}
        numEpisodes={episodeIDsChronologically.length}
        currentStep={currentStep}
        progressSteps={configState.uiConfigSequence.length}
        onSubmit={handleSubmitFeedback}
        onSubmitHover={setIsOnSubmit}
      />
      <Box
        id="feedback-interface"
        sx={{
          display: "flex",
          flex: 1,
          width: "100%",
          overflow: "scroll",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        {showCheckpointProgress && (
          <Box
            sx={{
              position: "absolute",
              top: 10,
              left: 10,
              zIndex: 5,
              pointerEvents: "none",
            }}
          >
            <Chip
              label={`Checkpoint ${checkpointProgress.current}/${checkpointProgress.total}`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
        )}
        {feedbackMode === "ranking" ? (
          <DndContext sensors={sensors} onDragEnd={onDragEnd}>
            <Box
              id="ranking-panel"
              flexDirection={horizontalDrag ? "column" : "row"}
              sx={{
                display: "flex",
                height: "100%",
                width: "100%",
                boxSizing: "border-box",
                backgroundColor: theme.palette.background.l1,
              }}
            >
              {activeUIConfig.uiComponents.interactiveEpisodeSelect && (
                <ScrollableEpisodeList
                  episodeIDs={episodeIDsChronologically}
                  rankeableEpisodeIDs={rankeableEpisodeIDs}
                />
              )}
              <DroppableColumnContainer
                horizontalRanking={horizontalDrag}
                ranks={ranks}
                columnOrder={columnOrder}
              >
                {columnOrder.map((columnId) => {
                  const rank = ranks[columnId];
                  return (
                    <DroppableColumn
                      key={columnId}
                      droppableID={columnId}
                      episodeIDs={rank.episodeItemIDs}
                      title={rank.title}
                      scheduleFeedback={scheduleFeedback}
                      sessionId={sessionId}
                      actionLabels={actionLabels}
                      rank={rank.rank}
                      maxRank={columnOrder.length}
                      evalFeedback={evalFeedback}
                      updateEvalFeedback={updateEvalFeedback}
                      experimentId={selectedExperiment?.id ?? 0}
                      environmentId={selectedExperiment?.env_id ?? ""}
                      checkpoint={selectedCheckpoint}
                      onMouseEnter={handleEpisodeHover}
                      onMouseLeave={() => handleEpisodeHover(null)}
                      isHovered={hoveredEpisodeId === columnId}
                    />
                  );
                })}
              </DroppableColumnContainer>
            </Box>
          </DndContext>
        ) : (
          <Box
            id="best-of-k-panel"
            sx={{
              display: "flex",
              height: "100%",
              width: "100%",
              boxSizing: "border-box",
              backgroundColor: theme.palette.background.l1,
            }}
          >
            <BestOfKColumn
              episodeIDs={rankeableEpisodeIDs}
              onSelectBest={handleBestOfKSelection}
              selectedColumn={selectedColumn}
              scheduleFeedback={scheduleFeedback}
              sessionId={sessionId}
              actionLabels={actionLabels}
              evalFeedback={evalFeedback}
              updateEvalFeedback={updateEvalFeedback}
              experimentId={selectedExperiment?.id ?? 0}
              environmentId={selectedExperiment?.env_id ?? ""}
              checkpoint={selectedCheckpoint}
              onMouseEnter={handleEpisodeHover}
              onMouseLeave={() => handleEpisodeHover(null)}
              isHovered={hoveredEpisodeId === selectedColumn}
            />
          </Box>
        )}
      </Box>
    </RatingInfoContext.Provider>
  );
};

export default FeedbackInterface;
