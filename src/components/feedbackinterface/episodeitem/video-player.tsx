import React, { useState } from "react";
import { Box } from "@mui/material";

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
  const [videoAspectRatio, setVideoAspectRatio] = useState(0);
  
  // Handle video load and calculate aspect ratio
  const handleVideoLoad = (event: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = event.currentTarget;
    if (video.videoWidth && video.videoHeight) {
      const aspectRatio = video.videoWidth / video.videoHeight;
      setVideoAspectRatio(aspectRatio);
    }
    // Call the original onLoadMetadata prop
    onLoadMetadata();
  };

  return (
    <Box sx={{ 
      width: "100%", 
      height: "100%", 
      position: "relative",
      display: "flex",
      justifyContent: "center",
      alignItems: "center"
    }}>
      {videoURL && (
        <video
          ref={videoRef}
          onLoadedMetadata={handleVideoLoad}
          loop
          style={{
            // Landscape videos (width > height)
            ...(videoAspectRatio > 1 ? {
              width: "30vw", 
              height: "auto",
              maxHeight: "50vh" // Ensure it doesn't get too tall
            } : 
            // Portrait videos (height > width) or square
            {
              height: "50vh",
              width: "auto",
              maxWidth: "30vw" // Ensure it doesn't get too wide
            }),
            objectFit: "contain" // Maintain aspect ratio
          }}
        >
          <source src={videoURL} type="video/mp4" />
        </video>
      )}
    </Box>
  );
};

export default VideoPlayer;