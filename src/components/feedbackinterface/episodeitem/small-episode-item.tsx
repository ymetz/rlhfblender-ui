<<<<<<< HEAD
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
=======
import { Draggable } from '@hello-pangea/dnd';
>>>>>>> origin/vis-short-projections
import Box from "@mui/material/Box";
import { useEffect, useState, useRef } from "react";
import { IDfromEpisode } from "../../../id";
import Lock from "@mui/icons-material/Lock";
import { Episode } from "../../../types";
import { Tooltip } from "@mui/material";
import { useGetter } from "../../../getter-context";
import React from "react";

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
  const draggableId = isRankeable
    ? `${IDfromEpisode(episodeID)}_duplicate`
    : IDfromEpisode(episodeID);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({
    id: draggableId,
    data: { containerId: "scrollable-episode-list" },
    disabled: isRankeable,
  });
  const videoRef = useRef<HTMLVideoElement>(document.createElement("video"));
  const [thumbnailURL, setThumbnailURL] = useState("");
  const [videoURL, setVideoURL] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getThumbnail = useGetter().getThumbnailURL;
  const getVideoURL = useGetter().getVideoURL;

  const handleMouseEnter = () => {
    hoverTimeout.current = setTimeout(() => {
      setEnlarged(true && !isRankeable);
    }, 1000); // Adjust the duration as needed (in milliseconds)
    setHovered(true && !isRankeable);
  };

  const handleMouseLeave = () => {
    if (hoverTimeout.current) {
      clearTimeout(hoverTimeout.current);
    }
    setHovered(false);
    setEnlarged(false);
  };

  useEffect(() => {
    getThumbnail(IDfromEpisode(episodeID)).then((url) => {
      if (url !== undefined) {
        setThumbnailURL(url);
      }
    });
  });

  useEffect(() => {
    getVideoURL(IDfromEpisode(episodeID)).then((url) => {
      if (url !== undefined) {
        setVideoURL(url);
      }
    });
  }, [dialogOpen, episodeID, getVideoURL]);

  return (
    <Box
      key={draggableIndex}
      ref={setNodeRef}
      onDoubleClick={() => {
        setDialogOpen(true);
      }}
      {...attributes}
      {...listeners}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      sx={{
        alignItems: "center",
        m: 1,
        opacity: hovered ? 1.0 : 0.5,
        transform: enlarged ? "scale(1.5)" : "scale(1)", // Apply enlargement effect
        transition: "transform 0.3s, opacity 0.3s",
      }}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      {enlarged ? (
        <video
          ref={videoRef}
          src={videoURL}
          style={{
            minWidth: 0,
            maxWidth: "3vw",
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
            maxWidth: "3vw",
          }}
        />
      )}
      {isRankeable && (
        <Tooltip title="This episode is already in the ranking section">
          <Lock
            sx={{
              position: "absolute",
              top: 0,
              right: 0,
              color: "white",
              opacity: 1.0,
            }}
          />
        </Tooltip>
      )}
    </Box>
  );
};

export default SmallEpisodeItem;
