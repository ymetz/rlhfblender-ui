// FeedbackInterface.tsx

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DragDropContext, DropResult } from 'react-beautiful-dnd';
import { Box, Typography, Button } from '@mui/material';
import Send from '@mui/icons-material/Send';

import DroppableColumn from './feedbackinterface/droppable-column';
import ScrollableEpisodeList from './feedbackinterface/scrollable-episode-list';
import DemoModal from './modals/demo-modal';
import Progressbar from './feedbackinterface/progressbar';

import { styled } from '@mui/system';
import { useTheme } from '@mui/material/styles';
import { RatingInfoContext } from '../rating-info-context';
import { EpisodeFromID, IDfromEpisode } from '../id';
import axios from 'axios';

import { Episode, Feedback, FeedbackType } from '../types';
import { useAppState, useAppDispatch } from '../AppStateContext';

// Styled components and helper functions remain the same
interface StyledDroppableColumnContainerProps {
  columnOrder: string[];
  horizontalRanking: boolean;
  ranks: {
    [key: string]: {
      rank: number;
      title: string;
      episodeItemIDs: string[];
    };
  };
}

function generateTemplateColumns(props: StyledDroppableColumnContainerProps) {
  let templateString = '';
  if (props.horizontalRanking) {
    for (let i = 0; i < props.columnOrder.length; i++) {
      if (props.ranks[props.columnOrder[i]].episodeItemIDs.length > 0) {
        templateString += 'minmax(20%, 1fr) ';
      } else {
        templateString += 'auto ';
      }
    }
  } else {
    templateString = '1fr';
  }
  return templateString;
}

function generateTemplateRows(props: StyledDroppableColumnContainerProps) {
  let templateString = '';
  if (props.horizontalRanking) {
    templateString = '1fr';
  } else {
    for (let i = 0; i < props.columnOrder.length; i++) {
      if (props.ranks[props.columnOrder[i]].episodeItemIDs.length > 0) {
        templateString += '1fr ';
      } else {
        templateString += 'auto ';
      }
    }
  }
  return templateString;
}

const DroppableColumnContainer = styled('div')<StyledDroppableColumnContainerProps>`
  display: grid;
  flex: 1;
  grid-template-columns: ${props => generateTemplateColumns(props)};
  grid-template-rows: ${props => generateTemplateRows(props)};
  overflow-y: auto;
`;

const FeedbackInterface: React.FC = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const theme = useTheme();

  // Destructure necessary state variables
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

  // Local state variables
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [ranks, setRanks] = useState({});
  const numEpisodes = episodeIDsChronologically.length;
  const [demoModalOpen, setDemoModalOpen] = useState({
    open: false,
    seed: 0,
  });
  const [isOnSubmit, setIsOnSubmit] = useState(false);
  const [evalFeedback, setEvalFeedback] = useState({});
  const horizontalDrag = activeUIConfig.uiComponents.horizontalRanking;

  const updateEvalFeedback = useCallback((episodeId: string, newRating: number) => {
    setEvalFeedback(prevRatings => ({
      ...prevRatings,
      [episodeId]: newRating,
    }));
  }, []);

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

  const sampleEpisodes = async () => {
    if (state.selectedExperiment.id === -1) {
      return;
    }
    try {
      const response = await axios.get('/data/sample_episodes', {
        params: { num_episodes: state.activeUIConfig.max_ranking_elements, sessionId: sessionId },
      });
      dispatch({
        type: 'SET_ACTIVE_EPISODES',
        payload: response.data.map((e: any) => IDfromEpisode(e)),
      });
      dispatch({
        type: 'SET_RANKEABLE_EPISODE_IDS',
        payload: response.data.map((e: any) => IDfromEpisode(e)),
      });
    } catch (error) {
      console.error('Error sampling episodes:', error);
    }
  };

  // Define scheduleFeedback function
  const scheduleFeedback = useCallback((feedback: Feedback) => {
    dispatch({ type: 'SCHEDULE_FEEDBACK', payload: feedback });
  }, [dispatch]);

  // Define submitFeedback function
  const submitFeedback = () => {
    // Submit all scheduled feedback to the server
    const feedbacks = state.scheduledFeedback;
    axios.post('/data/give_feedback', feedbacks).then(() => {
      // Clear scheduled feedback after successful submission
      dispatch({ type: 'CLEAR_SCHEDULED_FEEDBACK' });
      // Fetch new episodes after feedback submission
      sampleEpisodes();
      
    }).catch(error => {
      console.error('Error submitting feedback:', error);
    });
  };

  // Define hasFeedback function
  const hasFeedback = useCallback((episode: Episode, feedbackType: FeedbackType) => {
    // Check if the episode has feedback of a specific type
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

  return (
    <RatingInfoContext.Provider value={ratingInfoValue}>
      <Box sx={{ display: 'flex', flexDirection: 'row' }}>
        {activeUIConfig.uiComponents.progressBar && (
          <Box
            id="progress-bar"
            sx={{
              display: 'flex',
              flex: 1,
              boxSizing: 'border-box',
              backgroundColor: theme.palette.background.l1,
              padding: 0.5,
            }}
          >
            <Typography
              sx={{
                color: theme.palette.text.secondary,
                m: 0.5,
                minWidth: '10vw',
              }}
            >
              Experiment Progress:
            </Typography>
            <Progressbar
              maxSteps={
                Math.ceil(
                  numEpisodes / activeUIConfig.max_ranking_elements
                ) ?? 1
              }
              currentStep={currentStep}
            />
          </Box>
        )}
        <Box sx={{ p: 1, backgroundColor: theme.palette.background.l1 }}>
          <Button
            variant="contained"
            endIcon={<Send />}
            onClick={submitFeedback}
            onMouseEnter={() => setIsOnSubmit(true)}
            onMouseLeave={() => setIsOnSubmit(false)}
          >
            Submit Feedback
          </Button>
        </Box>
      </Box>
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
              // Handle feedback submission from the demo modal
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
