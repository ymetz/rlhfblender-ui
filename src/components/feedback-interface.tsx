// React
import React, {useContext} from 'react';

// Drag and drop
import {DragDropContext, DropResult} from 'react-beautiful-dnd';

// Material UI
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Send from '@mui/icons-material/Send';
import {Button} from '@mui/material';

// Our components
import DroppableColumn from './feedbackinterface/droppable-column';
import ScrollableEpisodeList from './feedbackinterface/scrollable-episode-list';

// Types
import {Episode, UIConfig, Feedback, FeedbackType} from '../types';

// Context
import {UIConfigContext} from '../setup-ui-context';
import DemoModal from './feedbackinterface/demo-modal';

// Styled components
import { styled } from '@mui/system';
import {useTheme} from '@mui/material/styles';
import Progressbar from './feedbackinterface/progressbar';

import {RatingInfoContext} from '../rating-info-context';

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

interface FeedbackInterfaceProps {
  onDragEnd: (dropResult: DropResult) => void;
  currentProgressBarStep: number;
  episodeIDsChronologically: Episode[];
  activeUIConfig: UIConfig;
  parentWidthPx: number | undefined;
  rankeableEpisodeIDs: string[];
  columnOrder: string[];
  ranks: {
    [key: string]: {
      rank: number;
      title: string;
      episodeItemIDs: string[];
    };
  };
  scheduleFeedback: (feedback: Feedback) => void;
  onDemoModalSubmit: (feedback: Feedback) => void;
  activeEnvId: string;
  actionLabels: any[];
  sessionId: string;
  submitFeedback: () => void;
  hasFeedback: (episode: Episode, feedbackType: FeedbackType) => boolean;
}

const FeedbackInterface: React.FC<FeedbackInterfaceProps> = ({
  onDragEnd,
  currentProgressBarStep,
  episodeIDsChronologically,
  rankeableEpisodeIDs,
  columnOrder,
  ranks,
  scheduleFeedback,
  onDemoModalSubmit,
  activeEnvId,
  actionLabels,
  sessionId,
  submitFeedback,
  hasFeedback,
}) => {
  const activeUIConfig = useContext(UIConfigContext);
  const numEpisodes = episodeIDsChronologically.length;
  const [demoModalOpen, setDemoModalOpen] = React.useState({
    open: false,
    seed: 0,
  });
  const [isOnSubmit, setIsOnSubmit] = React.useState(false);
  const [evalFeedback, setEvalFeedback] = React.useState({});
  const horizontalDrag = activeUIConfig.uiComponents.horizontalRanking;
  const theme = useTheme();

  const updateEvalFeedback = (episodeId: string, newRating: number) => {
    setEvalFeedback(prevRatings => ({
      ...prevRatings,
      [episodeId]: newRating,
    }));
  };

  return (
    <RatingInfoContext.Provider
      value={{
        isOnSubmit: isOnSubmit,
        hasFeedback: hasFeedback,
      }}
    >
      <Box sx={{display: 'flex', flexDirection: 'row'}}>
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
              currentStep={currentProgressBarStep}
            />
          </Box>
        )}
        <Box sx={{p: 1, backgroundColor: theme.palette.background.l1}}>
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
            onClose={() => setDemoModalOpen({open: false, seed: 0})}
            onCloseSubmit={onDemoModalSubmit}
            custom_input={activeUIConfig.customInput}
            activeEnvId={activeEnvId}
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
