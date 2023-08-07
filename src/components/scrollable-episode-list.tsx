import React from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import {useRef} from 'react';
import {Droppable} from 'react-beautiful-dnd';
import SmallEpisodeItem from './small-episode-item';
import {Episode} from '../types';
import {IDfromEpisode} from '../id';
interface ScrollableEpisodeListProps {
  sliderValue: number;
  episodeCount: number;
  episodeIDs: Episode[];
  maxNumItemsInView: number;
  parentWidthPx?: number;
  horizontalDrag: boolean;
  // This is used to ensure that episodes that are already in the ranking
  // panel cannot be added again (by modifying the draggable status and
  // draggableID)
  rankeableEpisodeIDs: string[];
  getThumbnail: (episodeID: string) => Promise<string | undefined>;
}

const ScrollableEpisodeList: React.FC<ScrollableEpisodeListProps> = ({
  sliderValue,
  episodeCount,
  episodeIDs,
  maxNumItemsInView,
  parentWidthPx,
  rankeableEpisodeIDs,
  horizontalDrag,
  getThumbnail,
}) => {
  // Ensuring that the window size is always <= the number of episodes
  maxNumItemsInView = Math.min(maxNumItemsInView, episodeCount);

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
  const windowSize = useRef([window.innerWidth, window.innerHeight]);

  // Width of each item in the list
  if (parentWidthPx === null) {
    parentWidthPx = windowSize.current[0];
  }
  const pWidthPx =
    parentWidthPx === undefined ? windowSize.current[0] : parentWidthPx;
  const itemWidthPx = pWidthPx / maxNumItemsInView;

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
          sx={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: '100%',
            height: '100%',
            width: '5vw',
            boxSizing: 'border-box',
            overflow: 'auto',
            p: 1,
          }}
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          {
            // Create `episodeCount` boxes showing their index
            Array.from(Array(episodeCount).keys()).map(index => (
              <SmallEpisodeItem
                horizontalDrag={horizontalDrag}
                key={index}
                isRankeable={rankeableEpisodeIDs.includes(
                  IDfromEpisode(episodeIDs[index])
                )}
                episodeID={episodeIDs[index]}
                color={colors[index % colors.length]}
                draggableIndex={draggableIndex++}
                itemWidthPx={itemWidthPx}
                sliderValue={sliderValue}
                pWidthPx={pWidthPx}
                getThumbnail={getThumbnail}
                marginPx={5}
              />
            ))
          }
          {provided.placeholder}
        </Box>
      )}
    </Droppable>
  );
};
export default ScrollableEpisodeList;
