import React, {useContext} from 'react';
import {Droppable} from 'react-beautiful-dnd';
import EpisodeItem from './episodeitem/episode-item';
import Box from '@mui/material/Box';
import {Feedback} from '../../types';
import Chip from '@mui/material/Chip';
import {UIConfigContext} from '../../setup-ui-context';
import {useTheme} from '@mui/material/styles';
import chroma from 'chroma-js';

type DroppableColumnProps = {
  droppableID: string;
  title: string;
  episodeIDs: string[];
  scheduleFeedback: (pendingFeedback: Feedback) => void;
  sessionId: string;
  rank: number;
  maxRank: number;
  evalFeedback: {[episodeId: string]: number};
  updateEvalFeedback: (episodeId: string, rating: number) => void;
  setDemoModalOpen: ({open, seed}: {open: boolean; seed: number}) => void;
  actionLabels: any[];
};

const DroppableColumn: React.FC<DroppableColumnProps> = ({
  droppableID,
  title,
  episodeIDs,
  scheduleFeedback,
  sessionId,
  rank,
  maxRank,
  evalFeedback,
  updateEvalFeedback,
  setDemoModalOpen,
  actionLabels,
}) => {
  const UIConfig = useContext(UIConfigContext);
  const horizontalRanking = UIConfig.uiComponents.horizontalRanking;
  const theme = useTheme();
  return (
    // This box lives within a flex container with direction row. So if we put flex: 1, it will distribute the remaining space, even if nothing is contained.
    (<Box
      sx={{
        display: 'flex',
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 'auto',
        flexDirection: horizontalRanking ? 'column' : 'row',
        borderLeft: horizontalRanking
          ? `1px solid ${theme.palette.divider}`
          : 'none',
        borderTop: horizontalRanking
          ? 'none'
          : `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.l1,
      }}
    >
      <Droppable
        droppableId={droppableID}
        direction={horizontalRanking ? 'vertical' : 'horizontal'}
      >
        {(provided, snapshot) => (
          // We want this box to fill the remaining space, thus flex: 1
          (<>
            <Chip
              label={title.split(' ').at(-1) + '.'}
              sx={{
                borderRadius: horizontalRanking ? '5px 5px 0 0' : '5px 0 0 5px',
                m: 1,
                marginRight: 0,
                mb: 0,
                backgroundColor: chroma
                  .mix(
                    theme.palette.primary.main,
                    theme.palette.background.l0,
                    rank / maxRank
                  )
                  .hex(),
                boxShadow: snapshot.isDraggingOver
                  ? `0px 0px 10px 0px ${theme.palette.primary.main}`
                  : 'none',
                minHeight: '4vh',
                width: '4vh',
                border: `1px solid ${theme.palette.divider}`,
                borderBottom: horizontalRanking
                  ? 'none'
                  : `1px solid ${theme.palette.divider}`,
                borderRight: horizontalRanking
                  ? `1px solid ${theme.palette.divider}`
                  : 'none',
              }}
            />
            <Box
              ref={provided.innerRef}
              {...provided.droppableProps}
              sx={{
                backgroundColor: snapshot.isDraggingOver
                  ? chroma
                      .mix(
                        theme.palette.background.l0,
                        theme.palette.primary.main,
                        0.01
                      )
                      .hex()
                  : theme.palette.background.l0,
                display: 'flex',
                flexDirection: horizontalRanking ? 'column' : 'row',
                margin: 1,

                // Here I have to put flex 1 because I want to fill out the white with the grey
                flex: 1,
                marginLeft: horizontalRanking ? 'none' : 0,
                marginTop: horizontalRanking ? 0 : 'none',
                borderRadius: horizontalRanking ? '0 0 5px 5px' : '0 5px 5px 0',
                minHeight: horizontalRanking ? 'none' : '4vh', // To match chip if collapsed,
                minWidth: horizontalRanking ? '4vh' : 'none', // To match chip if collapsed,
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              {episodeIDs.map((episodeID: string, index: number) => (
                <EpisodeItem
                  key={episodeID}
                  episodeID={episodeID}
                  index={index}
                  scheduleFeedback={scheduleFeedback}
                  numItemsInColumn={episodeIDs.length}
                  sessionId={sessionId}
                  evalFeedback={evalFeedback[episodeID]}
                  updateEvalFeedback={updateEvalFeedback}
                  setDemoModalOpen={setDemoModalOpen}
                  actionLabels={actionLabels}
                />
              ))}
              {provided.placeholder}
            </Box>
          </>)
        )}
      </Droppable>
      {/* Container of item */}
    </Box>)
  );
};

export default DroppableColumn;
