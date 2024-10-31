import React from 'react';
import { Box, Typography } from '@mui/material';
import VideoPlayer from './video-player';

interface EnvRenderProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  videoURL: string;
  onLoadMetadata: () => void;
  hasFeatureSelectionFeedback: boolean;
  showFeatureSelection: boolean;
  onFeatureSelect: () => void;
  playButtonHandler: () => void;
  playing: boolean;
  mission?: string;
  horizontalRanking?: boolean;
}

const EnvRender: React.FC<EnvRenderProps> = ({
  videoRef,
  videoURL,
  onLoadMetadata,
  hasFeatureSelectionFeedback,
  showFeatureSelection,
  onFeatureSelect,
  playButtonHandler,
  playing,
  mission,
  horizontalRanking,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: horizontalRanking ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gridArea: 'envRender',
        maxWidth: '25vh', // Constrain width to the same max width as the video
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
      {mission && (
        <Box
          sx={{
            padding: '8px',
            border: '1px solid gray',
            borderRadius: '4px',
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            marginLeft: horizontalRanking ? '10px' : '0',
            marginTop: horizontalRanking ? '0' : '10px',
            maxWidth: '100%', // Ensure it stays within the parent width
            maxHeight: '25%',
          }}
        >
          <Typography variant="body1">
            Task: {mission}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default EnvRender;
