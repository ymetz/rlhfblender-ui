import React from "react";
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
  return (
    <Box sx={{ width: "100%", height: "100%", position: "relative" }}>
      {videoURL && (
        <video
          ref={videoRef}
          onLoadedMetadata={onLoadMetadata}
          loop
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }}
        >
          <source src={videoURL} type="video/mp4" />
        </video>
      )}
    </Box>
  );
};

export default VideoPlayer;
