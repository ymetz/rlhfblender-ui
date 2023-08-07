import {Draggable} from 'react-beautiful-dnd';
import Box from '@mui/material/Box';
import {useEffect, useState} from 'react';
import {DragHandle} from '@mui/icons-material';
import {Episode} from '../types';
import {IDfromEpisode} from '../id';
import React from 'react';

interface SmallEpisodeItemProps {
  isRankeable: boolean;
  episodeID: Episode;
  color: string;
  draggableIndex: number;
  sliderValue: number;
  itemWidthPx: number;
  pWidthPx: number;
  marginPx: number;
  horizontalDrag: boolean;
  getThumbnail: (episodeID: string) => Promise<string | undefined>;
}

const SmallEpisodeItem: React.FC<SmallEpisodeItemProps> = ({
  isRankeable,
  episodeID,
  color,
  draggableIndex,
  itemWidthPx,
  sliderValue,
  pWidthPx,
  marginPx,
  getThumbnail,
  horizontalDrag,
}) => {
  const [thumbnailURL, setThumbnailURL] = useState('');

  useEffect(() => {
    getThumbnail(IDfromEpisode(episodeID)).then(url => {
      if (url !== undefined) {
        setThumbnailURL(url);
      }
    });
  });

  const offset = (activeIndex: number) => {
    if (activeIndex === undefined) {
      return 0;
    }
    return pWidthPx / 2 - activeIndex * itemWidthPx;
  };
  let draggableID = IDfromEpisode(episodeID);
  if (isRankeable) {
    draggableID += '_duplicate';
  }

  return (
    <Draggable
      draggableId={draggableID}
      index={draggableIndex}
      // If this item is already rankeable, then we should not be able to
      // drag it into the ranking panel again.
      isDragDisabled={isRankeable}
    >
      {provided => (
        <Box
          key={draggableIndex}
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          sx={{
            bgcolor: isRankeable ? 'grey' : color,
            // transform: `translate(${
            //     horizontalDrag ? offset(sliderValue) : 0}px, ${horizontalDrag ? 0: offset(sliderValue)}px)`,
            transition: 'transform 0.5s ease',
            borderRadius: `${itemWidthPx / 7}px`,
            display: 'flex',
            width: '100%',
            boxShadow: 15,
            flex: 1,
          }}
        >
          <DragHandle
            sx={{
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
              color: color,
            }}
          />
          <img
            src={thumbnailURL}
            alt="thumbnail"
            style={{opacity: '0.1', minWidth: 0}}
          />
        </Box>
      )}
    </Draggable>
  );
};

export default SmallEpisodeItem;
