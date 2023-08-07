import React from 'react';
import {Droppable} from 'react-beautiful-dnd';
import EpisodeItem from './episode-item';
import Box from '@mui/material/Box';
import {Feedback} from '../types';
import Chip from '@mui/material/Chip';

type DroppableColumnProps = {
  droppableID: string;
  title: string;
  episodeIDs: string[];
  horizontalDrag: boolean;
  customInput: string;
  scheduleFeedback: (pendingFeedback: Feedback) => void;
  getVideo: (videoURL: string) => Promise<string | undefined>;
  getThumbnailURL: (episodeID: string) => Promise<string | undefined>;
  getRewards: (episodeID: string) => Promise<number[] | undefined>;
};

const DroppableColumn: React.FC<DroppableColumnProps> = ({
  droppableID,
  title,
  episodeIDs,
  horizontalDrag,
  customInput,
  scheduleFeedback,
  getVideo,
  getThumbnailURL,
  getRewards,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: horizontalDrag ? 'column' : 'row',
        borderLeft: horizontalDrag ? '1px solid rgba(0,0,0,0.2)' : 'none',
        borderTop: horizontalDrag ? 'none' : '1px solid rgba(0,0,0,0.2)',
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      {/* Chip is fixed size */}
      <Chip
        label={title.split(' ').at(-1) + '.'}
        sx={{
          borderTopLeftRadius: 5,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: 5,
          borderBottomRightRadius: 0,
          m: 1,
          marginRight: 0,
          mb: 0,
          backgroundColor: '#d8d8d8',
          height: '4vh',
        }}
      />
      <Droppable droppableId={droppableID} direction="horizontal">
        {provided => (
          // We want this box to fill the remaining space, thus flex: 1
          <Box
            ref={provided.innerRef}
            {...provided.droppableProps}
            sx={{
              display: 'flex',
              flexDirection: 'row',
              flex: 1,
              margin: 1,
              marginLeft: 0,
              borderRadius: '0 5px 5px 0',
              borderTopLeftRadius: 0,
              boxShadow: 'inset 0px 0px 100px 0px rgba(0,0,0,0.2)',
              minHeight: '4vh', // To match chip if collapsed,
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {episodeIDs.map((episodeID: string, index: number) => (
              <EpisodeItem
                key={episodeID}
                episodeID={episodeID}
                index={index}
                scheduleFeedback={scheduleFeedback}
                getVideo={getVideo}
                getRewards={getRewards}
                getThumbnailURL={getThumbnailURL}
                horizontalDrag={horizontalDrag}
                customInput={customInput}
              />
            ))}
            {provided.placeholder}
          </Box>
        )}
      </Droppable>
      {/* Container of item */}
    </Box>
  );
};

export default DroppableColumn;
