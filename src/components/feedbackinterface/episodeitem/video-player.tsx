// video-player.tsx
import React, { useState } from "react";
import { Box, Skeleton } from "@mui/material";

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoURL: string;
  onLoadMetadata: () => void;
  hasFeatureSelectionFeedback: boolean;
  showFeatureSelection: boolean;
  onFeatureSelect: () => void;
  playButtonHandler: () => void;
  playing: boolean;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoRef,
  videoURL,
  onLoadMetadata,
}) => {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);

  // Constants for container dimensions
  const CONTAINER_WIDTH = "30vw";
  const CONTAINER_HEIGHT = "50vh";

  // Handle video load
  const handleVideoLoad = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    setVideoLoaded(true);
    setVideoError(false);
    // Call the original onLoadMetadata prop
    onLoadMetadata();
  };

  // Handle video error
  const handleVideoError = () => {
    setVideoError(true);
    setVideoLoaded(false);
  };

  return (
    <Box 
      sx={{
        width: CONTAINER_WIDTH,
        height: CONTAINER_HEIGHT,
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        // Ensure the container never collapses
        minWidth: CONTAINER_WIDTH,
        minHeight: CONTAINER_HEIGHT,
        backgroundColor: "background.paper",
        overflow: "hidden",
        // Ensure a smooth transition when content changes
        transition: "all 0.2s ease-in-out"
      }}
    >
      {/* Placeholder/skeleton while video is loading */}
      {!videoLoaded && !videoError && (
        <Skeleton
          variant="rectangular"
          width="100%"
          height="100%"
          animation="wave"
          sx={{ position: "absolute", top: 0, left: 0 }}
        />
      )}

      {/* Error message if video fails to load */}
      {videoError && (
        <Box
          sx={{
            width: "100%",
            height: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            color: "text.secondary",
            backgroundColor: "background.paper",
          }}
        >
          Could not load video
        </Box>
      )}

      {/* The actual video element */}
      {videoURL && (
        <video
          ref={videoRef}
          onLoadedMetadata={handleVideoLoad}
          onError={handleVideoError}
          loop
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain", // Maintain aspect ratio
            opacity: videoLoaded ? 1 : 0, // Hide until loaded
            transition: "opacity 0.3s ease-in-out"
          }}
        >
          <source src={videoURL} type="video/mp4" />
        </video>
      )}
    </Box>
  );
};

export default React.memo(VideoPlayer);