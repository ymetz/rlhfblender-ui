// env-render.tsx (optimized version)
import React, { memo } from "react";
import { Box, Typography, IconButton } from "@mui/material";
import VideoPlayer from "./video-player";
import FeatIcon from "../../../icons/feat-icon";

interface EnvRenderProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoURL: string;
  onLoadMetadata: () => void;
  hasFeatureSelectionFeedback: boolean;
  showFeatureSelection: boolean;
  onFeatureSelect: () => void;
  playButtonHandler: () => void;
  videoSliderHandler: (value: number | number[]) => void;
  playing: boolean;
  mission?: string;
  toolControls?: React.ReactNode;
  overlayContent?: React.ReactNode;
}

const EnvRender: React.FC<EnvRenderProps> = memo(({
  videoRef,
  videoURL,
  onLoadMetadata,
  hasFeatureSelectionFeedback,
  showFeatureSelection,
  onFeatureSelect,
  playButtonHandler,
  videoSliderHandler,
  playing,
  mission,
  toolControls,
  overlayContent,
}) => {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gridArea: "envRender",
        justifySelf: "center",
        marginTop: "1rem",
        alignSelf: "center",
        border: (theme) => `1px solid ${theme.palette.divider}`,
        borderRadius: "10px",
        overflow: "hidden", // Ensures nothing breaks out of the container
        ...(hasFeatureSelectionFeedback && {
          outline: (theme) => `2px solid ${theme.palette.primary.main}`,
          boxShadow: (theme) =>
            `0px 0px 20px 0px ${theme.palette.primary.main}`,
          outlineOffset: "-1px",
        }),
      }}
    >
      {/* Mission Text */}
      {mission && (
        <Box
          sx={{
            padding: "4px 8px",
            borderBottom: (theme) => `1px solid ${theme.palette.divider}`,
            bgcolor: (theme) => theme.palette.background.default,
          }}
        >
          <Typography
            variant="body2"
            sx={{
              color: "text.secondary",
              fontSize: "0.8rem",
              lineHeight: 1.2,
            }}
          >
            Task: {mission}
          </Typography>
        </Box>
      )}

      {/* Video Container */}
      <Box
        sx={{
          display: "flex",
          position: "relative",
          width: "100%",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <VideoPlayer
          videoRef={videoRef}
          videoURL={videoURL}
          onLoadMetadata={onLoadMetadata}
          hasFeatureSelectionFeedback={hasFeatureSelectionFeedback}
          showFeatureSelection={showFeatureSelection}
          onFeatureSelect={onFeatureSelect}
          playButtonHandler={playButtonHandler}
          playing={playing}
        />

        {toolControls && (
          <Box
            sx={{
              position: "absolute",
              top: "4px",
              right: "4px",
              zIndex: 4,
            }}
          >
            {toolControls}
          </Box>
        )}

        {showFeatureSelection && !toolControls && (
          <IconButton
            onClick={onFeatureSelect}
            sx={{
              position: "absolute",
              top: "4px",
              left: "4px",
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              padding: "8px",
              color: (theme) =>
                hasFeatureSelectionFeedback
                  ? theme.palette.primary.light
                  : theme.palette.text.secondary,
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.7)",
              },
            }}
          >
            <FeatIcon />
          </IconButton>
        )}

        {overlayContent && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              zIndex: 3,
              display: "flex",
              flexDirection: "column",
              backgroundColor: "rgba(0, 0, 0, 0.25)",
            }}
          >
            {overlayContent}
          </Box>
        )}
      </Box>
    </Box>
  );
});

export default EnvRender;
