// video-player.tsx
import React, { useEffect, useState } from "react";
import { Box, Skeleton, IconButton } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";

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
  playButtonHandler,
  playing,
}) => {
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [videoAspectRatio, setVideoAspectRatio] = useState(16 / 9);

  useEffect(() => {
    setVideoLoaded(false);
    setVideoError(false);
    setVideoAspectRatio(16 / 9);
  }, [videoURL]);

  // Handle video load
  const handleVideoLoad = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const videoElement = event.currentTarget;
    if (videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
      setVideoAspectRatio(videoElement.videoWidth / videoElement.videoHeight);
    }
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
        width: "min(calc(100% - 16px), 33vw)",
        minWidth: 260,
        maxWidth: "100%",
        aspectRatio: `${videoAspectRatio}`,
        maxHeight: "56vh",
        boxSizing: "border-box",
        mx: "auto",
        my: 1,
        p: 0.5,
        position: "relative",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
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
          sx={{ position: "absolute", inset: 0 }}
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
        <>
          <video
            ref={videoRef}
            onLoadedMetadata={handleVideoLoad}
            onError={handleVideoError}
            loop
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              objectFit: "contain", // Maintain aspect ratio
              opacity: videoLoaded ? 1 : 0, // Hide until loaded
              transition: "opacity 0.3s ease-in-out"
            }}
          >
            <source src={videoURL} type="video/mp4" />
          </video>
          <IconButton
            size="small"
            onClick={playButtonHandler}
            sx={{
              position: "absolute",
              bottom: 6,
              right: 6,
              zIndex: 2,
              backgroundColor: playing
                ? "rgba(76, 175, 80, 0.85)"
                : "rgba(0, 0, 0, 0.55)",
              color: "common.white",
              "&:hover": {
                backgroundColor: playing
                  ? "rgba(76, 175, 80, 0.95)"
                  : "rgba(0, 0, 0, 0.75)",
              },
              p: 0.5,
            }}
          >
            {playing ? (
              <PauseIcon fontSize="small" />
            ) : (
              <PlayArrowIcon fontSize="small" />
            )}
          </IconButton>
        </>
      )}
    </Box>
  );
};

export default React.memo(VideoPlayer);
