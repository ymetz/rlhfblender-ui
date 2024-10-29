import {Draggable} from 'react-beautiful-dnd';
import Box from '@mui/material/Box';
import {useEffect, useState, useRef} from 'react';
import {IDfromEpisode} from '../../../id';
import Lock from '@mui/icons-material/Lock';
import {Episode} from '../../../types';
import {Tooltip} from '@mui/material';
import {useGetter} from '../../../getter-context';
import React from 'react';

interface SmallEpisodeItemProps {
  isRankeable: boolean;
  episodeID: Episode;
  draggableIndex: number;
}

const SmallEpisodeItem: React.FC<SmallEpisodeItemProps> = ({
  isRankeable,
  episodeID,
  draggableIndex,
}) => {
  const videoRef = useRef<HTMLVideoElement>(document.createElement('video'));
  const [thumbnailURL, setThumbnailURL] = useState('');
  const [videoURL, setVideoURL] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout>>();

  const getThumbnail = useGetter().getThumbnailURL;
  const getVideoURL = useGetter().getVideoURL;

  const handleMouseEnter = () => {
    hoverTimeout.current = setTimeout(() => {
      setEnlarged(true && !isRankeable);
    }, 1000); // Adjust the duration as needed (in milliseconds)
    setHovered(true && !isRankeable);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimeout.current);
    setHovered(false);
    setEnlarged(false);
  };

  useEffect(() => {
    getThumbnail(IDfromEpisode(episodeID)).then(url => {
      if (url !== undefined) {
        setThumbnailURL(url);
      }
    });
  });

  useEffect(() => {
    getVideoURL(IDfromEpisode(episodeID)).then(url => {
      if (url !== undefined) {
        setVideoURL(url);
      }
    });
  }, [dialogOpen, episodeID, getVideoURL]);

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
          onDoubleClick={() => {
            setDialogOpen(true);
          }}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          sx={{
            alignItems: 'center',
            m: 1,
            opacity: hovered ? 1.0 : 0.5,
            transform: enlarged ? 'scale(1.5)' : 'scale(1)', // Apply enlargement effect
            transition: 'transform 0.3s, opacity 0.3s',
          }}
        >
          {enlarged ? (
            <video
              ref={videoRef}
              src={videoURL}
              style={{
                minWidth: 0,
                maxWidth: '3vw',
              }}
              muted
              loop
              autoPlay
            />
          ) : (
            <img
              src={thumbnailURL}
              alt="thumbnail"
              style={{
                minWidth: 0,
                maxWidth: '3vw',
              }}
            />
          )}
          {isRankeable && (
            <Tooltip title="This episode is already in the ranking section">
              <Lock
                sx={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  color: 'white',
                  opacity: 1.0,
                }}
              />
            </Tooltip>
          )}
        </Box>
      )}
    </Draggable>
  );
};

export default SmallEpisodeItem;
