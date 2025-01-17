// FeedbackInterface.tsx
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { RatingInfoContext } from '../rating-info-context';
import { useAppDispatch, useAppState } from '../AppStateContext';
import { useSetupConfigState } from '../SetupConfigContext';
import { EpisodeFromID, IDfromEpisode } from '../id';
import { Episode, Feedback, FeedbackType } from '../types';

import { DroppableColumnContainer } from './feedbackinterface/styles';
import { useFeedbackState } from './feedbackinterface/hooks/useFeedbackState';
import { useConfigBasedSampling } from '../episodeSamplingWithSequence';
import { useFeedbackSubmission } from './feedbackinterface/hooks/useFeedbackSubmission';
import { ProgressHeader } from './feedbackinterface/progress-header';
import DroppableColumn from './feedbackinterface/droppable-column';
import BestOfKColumn from './feedbackinterface/best-of-k-column';
import ScrollableEpisodeList from './feedbackinterface/scrollable-episode-list';
import DemoModal from './modals/demo-modal';
import { useFeedbackShortcuts } from './feedbackinterface/hooks/useShortcuts';

// Add new type for feedback mode
type FeedbackMode = 'ranking' | 'bestOfK';

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
    actionLabels,
    sessionId,
    scheduledFeedback,
  } = state;
  const { activeUIConfig, uiConfigSequence } = useSetupConfigState();

  const [demoModalOpen, setDemoModalOpen] = useState({ open: false, seed: 0 });
  const [isOnSubmit, setIsOnSubmit] = useState(false);
  const [evalFeedback, setEvalFeedback] = useState({});
  
  // Determine feedback mode based on UI config
  const feedbackMode: FeedbackMode = activeUIConfig.uiComponents.bestOfK ? 'bestOfK' : 'ranking';
  const horizontalDrag = activeUIConfig.uiComponents.horizontalRanking && feedbackMode === 'ranking';

  const { columnOrder, setColumnOrder, ranks, setRanks } = useFeedbackState(rankeableEpisodeIDs);
  const { sampleEpisodes, advanceToNextStep } = useConfigBasedSampling();
  const { scheduleFeedback, submitFeedback } = useFeedbackSubmission(sampleEpisodes, advanceToNextStep);
  const [selectedColumn, setSelectedColumn] = useState<string | null>(null);

  // Handle best-of-k selection
  const handleBestOfKSelection = (selectedEpisodeId: string) => {
    const feedback: Feedback = {
      feedback_type: FeedbackType.Comparative,
      timestamp: Date.now(),
      session_id: sessionId,
      targets: rankeableEpisodeIDs.map(episodeId => ({
        target_id: episodeId,
        reference: EpisodeFromID(episodeId),
        origin: 'offline',
        timestamp: Date.now(),
      })),
      preferences: rankeableEpisodeIDs.map(episodeId => 
        episodeId === selectedEpisodeId ? 1 : 0
      ),
      granularity: 'episode',
    };

    setSelectedColumn(selectedEpisodeId);
    scheduleFeedback(feedback);
  };


  const updateEvalFeedback = (episodeId: string, newRating: number) => {
    setEvalFeedback(prevRatings => ({
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
        type: 'SET_FEEDBACK_INTERFACE_RESET', 
        payload: resetInitialization 
      });
      resetDispatchRef.current = true;
    }
  }, []);

  useEffect(() => {
    // Only run initial sampling once when conditions are met
    if (!isInitialized.current && 
        episodeIDsChronologically.length > 0 &&
        uiConfigSequence.length > 0
      ) {
      isInitialized.current = true;
      sampleEpisodes();
      setSelectedColumn(null);
    }
  }, [episodeIDsChronologically, sampleEpisodes, uiConfigSequence]);

// Define onDragEnd function
const onDragEnd = (dropResult: DropResult) => {
  const { destination, source, draggableId } = dropResult;

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
  const destDroppable = ranks[destDroppableId];

  const srcDroppableId = source.droppableId;
  const srcDroppable = ranks[srcDroppableId];

  let newState: {
    rankeableEpisodeIDs: string[];
    ranks: {
      [key: string]: { rank: number; title: string; episodeItemIDs: string[] };
    };
    columnOrder: string[];
  };

  const newRankeableEpisodeIDs: string[] = Array.from(rankeableEpisodeIDs);
  if (srcDroppableId === 'scrollable-episode-list') {
    // This is a new episode, so we need to add it to rankeableEpisodeIDs.
    newRankeableEpisodeIDs.push(draggableId);
  }

  if (
    srcDroppable === destDroppable ||
    srcDroppableId === 'scrollable-episode-list'
  ) {
    // Reordering within the same rank.
    const newEpisodeItemIDs = Array.from(destDroppable.episodeItemIDs);
    newEpisodeItemIDs.splice(source.index, 1);
    newEpisodeItemIDs.splice(destination.index, 0, draggableId);

    const newRank = {
      ...destDroppable,
      episodeItemIDs: newEpisodeItemIDs,
    };

    newState = {
      rankeableEpisodeIDs: newRankeableEpisodeIDs,
      ranks: {
        ...ranks,
        [destDroppableId]: newRank,
      },
      columnOrder: columnOrder,
    };
  } else {
    // Moving an episode from one rank to another.
    // Insert into destination rank.
    const newDestDraggableIDs = Array.from(destDroppable.episodeItemIDs);
    newDestDraggableIDs.splice(destination.index, 0, draggableId);

    // Remove from source rank.
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
      ranks: {
        ...ranks,
        [destDroppableId]: newDestRank,
        [srcDroppableId]: newSrcRank,
      },
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
    targets: orderedEpisodes.map(e => ({
      target_id: e.id,
      reference: e.reference,
      origin: 'offline',
      timestamp: Date.now(),
    })),
    preferences: orderedRanks,
    granularity: 'episode',
  };

  // Schedule the feedback
  scheduleFeedback(feedback);
};

  const hasFeedback = useCallback((episode: Episode, feedbackType: FeedbackType) => {
    return scheduledFeedback.some(
      feedback =>
        feedback.feedback_type === feedbackType &&
        feedback.targets?.some(target => target.target_id === IDfromEpisode(episode))
    );
  }, [scheduledFeedback]);

  const ratingInfoValue = useMemo(() => ({
    isOnSubmit,
    hasFeedback,
  }), [isOnSubmit, hasFeedback]);

  // Feedback shortcuts

  const handleDemoRequest = useCallback(() => {
    setDemoModalOpen({ open: true, seed: Math.random() });
  }, []);

  const handleFeatureAnnotation = useCallback((episodeId: string) => {
    console.log('Feature annotation for episode', episodeId);
  }, []);

  const { handleEpisodeHover, hoveredEpisodeId } = useFeedbackShortcuts({
    episodeIDs: rankeableEpisodeIDs,
    feedbackMode,
    onEvalFeedback: updateEvalFeedback,
    onBestOfKSelection: handleBestOfKSelection,
    onDemoRequest: handleDemoRequest,
    onFeatureAnnotation: handleFeatureAnnotation,
    uiConfigFeedbackComponents: activeUIConfig.feedbackComponents,
    scheduleFeedback,
    sessionId,
  });

  return (
    <RatingInfoContext.Provider value={ratingInfoValue}>
      <ProgressHeader
        showProgressBar={activeUIConfig.uiComponents.progressBar}
        numEpisodes={episodeIDsChronologically.length}
        currentStep={currentStep}
        progressSteps={configState.uiConfigSequence.length}
        onSubmit={() => submitFeedback(scheduledFeedback)}
        onSubmitHover={setIsOnSubmit}
      />
      <Box
        id="feedback-interface"
        sx={{
          display: 'flex',
          flex: 1,
          width: '100%',
          overflow: 'scroll',
          boxSizing: 'border-box',
        }}
      >
        {feedbackMode === 'ranking' ? (
          <DragDropContext onDragEnd={onDragEnd}>
            <Box
              id="ranking-panel"
              flexDirection={horizontalDrag ? 'column' : 'row'}
              sx={{
                display: 'flex',
                height: '100%',
                width: '100%',
                boxSizing: 'border-box',
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
                {columnOrder.map(columnId => {
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
                      setDemoModalOpen={setDemoModalOpen}
                      onMouseEnter={handleEpisodeHover}
                      onMouseLeave={() => handleEpisodeHover(null)}
                      isHovered={hoveredEpisodeId === columnId}
                    />
                  );
                })}
              </DroppableColumnContainer>
            </Box>
          </DragDropContext>
        ) : (
          <Box
            id="best-of-k-panel"
            sx={{
              display: 'flex',
              height: '100%',
              width: '100%',
              boxSizing: 'border-box',
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
              setDemoModalOpen={setDemoModalOpen}
              onMouseEnter={handleEpisodeHover}
              onMouseLeave={() => handleEpisodeHover(null)}
              isHovered={hoveredEpisodeId === selectedColumn}
            />
          </Box>
        )}
        <DemoModal
          open={demoModalOpen.open}
          onClose={() => setDemoModalOpen({ open: false, seed: 0 })}
          onCloseSubmit={feedback => {
            scheduleFeedback(feedback);
            setDemoModalOpen({ open: false, seed: 0 });
          }}
          custom_input={activeUIConfig.customInput}
          activeEnvId={selectedExperiment?.env_id ?? ''}
          sessionId={sessionId}
          inputProps={{}}
          seed={demoModalOpen.seed}
        />
      </Box>
    </RatingInfoContext.Provider>
  );
};

export default FeedbackInterface;
