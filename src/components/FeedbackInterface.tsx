// FeedbackInterface.tsx
import React, { useState, useMemo, useEffect } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { RatingInfoContext } from '../rating-info-context';
import { useAppState } from '../AppStateContext';
import { EpisodeFromID, IDfromEpisode } from '../id';
import { Episode, Feedback, FeedbackType } from '../types';

import { DroppableColumnContainer } from './feedbackinterface/styles';
import { useFeedbackState } from './feedbackinterface/hooks/useFeedbackState';
import { useEpisodeSampling } from './feedbackinterface/hooks/useEpisodeSampling';
import { useFeedbackSubmission } from './feedbackinterface/hooks/useFeedbackSubmission';
import { ProgressHeader } from './feedbackinterface/progress-header';
import DroppableColumn from './feedbackinterface/droppable-column';
import ScrollableEpisodeList from './feedbackinterface/scrollable-episode-list';
import DemoModal from './modals/demo-modal';

const FeedbackInterface: React.FC = () => {
  const state = useAppState();
  const theme = useTheme();

  const {
    activeUIConfig,
    currentStep,
    episodeIDsChronologically,
    rankeableEpisodeIDs,
    selectedExperiment,
    actionLabels,
    sessionId,
    scheduledFeedback,
  } = state;

  const [demoModalOpen, setDemoModalOpen] = useState({ open: false, seed: 0 });
  const [isOnSubmit, setIsOnSubmit] = useState(false);
  const [evalFeedback, setEvalFeedback] = useState({});
  const horizontalDrag = activeUIConfig.uiComponents.horizontalRanking;

  const { columnOrder, setColumnOrder, ranks, setRanks } = useFeedbackState(rankeableEpisodeIDs);
  const { sampleEpisodes } = useEpisodeSampling(selectedExperiment, activeUIConfig, sessionId);
  const { scheduleFeedback, submitFeedback } = useFeedbackSubmission(sampleEpisodes);

  const updateEvalFeedback = (episodeId: string, newRating: number) => {
    setEvalFeedback(prevRatings => ({
      ...prevRatings,
      [episodeId]: newRating,
    }));
  };

// Update column order and ranks when rankeableEpisodeIDs change
useEffect(() => {
  const new_ranks = Object.fromEntries(
    Array.from({ length: rankeableEpisodeIDs.length }, (_, i) => [
      `rank-${i}`,
      {
        rank: i + 1,
        title: `Rank ${i + 1}`,
        episodeItemIDs: [rankeableEpisodeIDs[i]],
      },
    ])
  );
  setRanks(new_ranks);
  setColumnOrder(Object.entries(new_ranks).map(([key, _]) => key));
}, [rankeableEpisodeIDs]);

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

  const hasFeedback = (episode: Episode, feedbackType: FeedbackType) => {
    return scheduledFeedback.some(
      feedback =>
        feedback.feedback_type === feedbackType &&
        feedback.targets?.some(target => target.target_id === IDfromEpisode(episode))
    );
  };

  const ratingInfoValue = useMemo(() => ({
    isOnSubmit,
    hasFeedback,
  }), [isOnSubmit, hasFeedback]);

  return (
    <RatingInfoContext.Provider value={ratingInfoValue}>
      <ProgressHeader
        showProgressBar={activeUIConfig.uiComponents.progressBar}
        numEpisodes={episodeIDsChronologically.length}
        currentStep={currentStep}
        maxRankingElements={activeUIConfig.max_ranking_elements}
        onSubmit={() => submitFeedback(scheduledFeedback)}
        onSubmitHover={setIsOnSubmit}
      />
      <Box
        id="feedback-interface"
        sx={{
          display: 'flex',
          flex: 1,
          width: '100%',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
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
                  />
                );
              })}
            </DroppableColumnContainer>
          </Box>
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
        </DragDropContext>
      </Box>
    </RatingInfoContext.Provider>
  );
};

export default FeedbackInterface;
