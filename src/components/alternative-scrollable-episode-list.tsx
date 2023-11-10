import AlternativeScrollbar from './alt-scrollbar';
import SmallEpisodeItem from './small-episode-item';
import Box from '@mui/material/Box';
import {Episode} from '../types';
import {IDfromEpisode} from '../id';
import {Droppable} from 'react-beautiful-dnd';
import React from 'react';

interface AlternativeScrollableEpisodeListProps {
  episodeIDs: Episode[];
  rankeableEpisodeIDs: string[];
  getThumbnail: (episodeID: string) => Promise<string | undefined>;
}

const AlternativeScrollableEpisodeList: React.FC<
  AlternativeScrollableEpisodeListProps
> = ({episodeIDs, rankeableEpisodeIDs, getThumbnail}) => {
  // Colors only used for debugging
  const colors = [
    '#fbf8cc',
    '#fde4cf',
    '#ffcfd2',
    '#f1c0e8',
    '#cfbaf0',
    '#a3c4f3',
    '#90dbf4',
    '#8eecf5',
    '#98f5e1',
    '#b9fbc0',
  ];
  let draggableIndex = 0;
  return (
    <Droppable
      droppableId={'scrollable-episode-list'}
      direction="horizontal"
      isDropDisabled={true}
    >
      {provided => (
        <Box
          id="scrollable-episode-list"
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          <AlternativeScrollbar>
            {episodeIDs.map((episodeID, index) => (
              <SmallEpisodeItem
                key={index}
                color={colors[index % colors.length]}
                isRankeable={rankeableEpisodeIDs.includes(
                  IDfromEpisode(episodeID)
                )}
                episodeID={episodeID}
                draggableIndex={draggableIndex++}
                getThumbnail={getThumbnail}
              />
            ))}
          </AlternativeScrollbar>
        </Box>
      )}
    </Droppable>
  );
};

export default AlternativeScrollableEpisodeList;
