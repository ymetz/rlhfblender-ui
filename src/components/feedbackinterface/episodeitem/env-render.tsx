import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import VideoPlayer from './video-player';
import FeatIcon from '../../../icons/feat-icon';

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
}

const EnvRender: React.FC<EnvRenderProps> = ({
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
}) => {
  const handleStep = (direction: 'forward' | 'backward') => {
    if (videoRef.current) {
      const frameTime = 1/30;
      videoSliderHandler(direction === 'forward' ? 
        videoRef.current.currentTime + frameTime : 
        videoRef.current.currentTime - frameTime
      );
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gridArea: 'envRender',
        width: '20vw',
        maxWidth: '25vh',
        justifySelf: 'center',
        alignSelf: 'center',
        border: theme => `1px solid ${theme.palette.divider}`,
        borderRadius: '10px',
        overflow: 'hidden', // Ensures nothing breaks out of the container
      }}
    >
      {/* Mission Text */}
      {mission && (
        <Box
          sx={{
            padding: '4px 8px',
            borderBottom: theme => `1px solid ${theme.palette.divider}`,
            bgcolor: theme => theme.palette.background.default,
          }}
        >
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'text.secondary',
              fontSize: '0.8rem',
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
          //position: 'relative',
          //aspectRatio: '1',
          //height: '100%',
          //width: '100%', instead center vertically
          display: 'flex',
          ...(hasFeatureSelectionFeedback && {
            outline: theme => `1px solid ${theme.palette.primary.main}`,
            outlineOffset: '-1px',
          }),
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
        
        {showFeatureSelection && (
          <IconButton
            onClick={onFeatureSelect}
            sx={{
              position: 'absolute',
              bottom: 4,
              right: 4,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              padding: '8px',
              color: theme =>
                hasFeatureSelectionFeedback
                  ? theme.palette.primary.light
                  : theme.palette.text.secondary,
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
              },
            }}
          >
            <FeatIcon />
          </IconButton>
        )}
      </Box>

      {/* Video Controls */}
      <Box sx={{ 
        display: 'flex', 
        height: '1.5rem',
        justifyContent: 'center', 
        gap: 0.5,
        //padding: '4px',
        bgcolor: theme => theme.palette.background.default,
      }}>
        <IconButton
          size="small"
          onClick={() => handleStep('backward')}
          sx={{ 
            color: 'text.secondary',
            padding: '4px',
          }}
        >
          <ChevronLeftIcon sx={{ fontSize: '1.2rem' }} />
        </IconButton>
        <IconButton
          size="small"
          onClick={playButtonHandler}
          sx={{ 
            color: 'text.secondary',
            padding: '4px',
          }}
        >
          {playing ? 
            <PauseIcon sx={{ fontSize: '1.2rem' }} /> : 
            <PlayArrowIcon sx={{ fontSize: '1.2rem' }} />
          }
        </IconButton>
        <IconButton
          size="small"
          onClick={() => handleStep('forward')}
          sx={{ 
            color: 'text.secondary',
            padding: '4px',
          }}
        >
          <ChevronRightIcon sx={{ fontSize: '1.2rem' }} />
        </IconButton>
      </Box>
    </Box>
  );
};

export default EnvRender;