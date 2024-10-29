import React, { useState } from 'react';
import { Box, Fade, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { FastForwardSharp, FastRewind, PauseSharp, PlayArrowSharp } from '@mui/icons-material';
import FeatIcon from '../../../icons/feat-icon';

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
  hasFeatureSelectionFeedback,
  showFeatureSelection,
  onFeatureSelect,
  playButtonHandler,
  playing,
}) => {
  const [mouseOnVideo, setMouseOnVideo] = useState(false);
  const theme = useTheme();

  return (
    <Box
      sx={{
        gridArea: 'video',
        justifySelf: 'center',
        alignSelf: 'center',
        borderRadius: '10px',
        border: hasFeatureSelectionFeedback
          ? `1px solid ${theme.palette.primary.main}`
          : `1px solid ${theme.palette.divider}`,
        m: 1,
        overflow: 'hidden',
        position: 'relative',
        width: '100%',
        height: '100%',
        maxHeight: '25vh',
        maxWidth: '25vh',
      }}
    >
      {videoURL && (
        <video
          ref={videoRef}
          onLoadedMetadata={onLoadMetadata}
          controlsList={mouseOnVideo ? 'default' : 'none'}
          loop
          onMouseEnter={() => setMouseOnVideo(true)}
          onMouseLeave={() => setMouseOnVideo(false)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        >
          <source src={videoURL} type="video/mp4" />
        </video>
      )}
                  <Box
              sx={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                display: 'grid',
                gridTemplateRows: '1fr',
                gridTemplateColumns: showFeatureSelection
                  ? '1fr'
                  : '75% auto',
              }}
            >
              <Fade in={mouseOnVideo} timeout={500}>
                <Box
                  onMouseEnter={() => setMouseOnVideo(true)}
                  onMouseLeave={() => setMouseOnVideo(false)}
                  sx={{
                    gridTemplateRows: '1fr',
                    gridTemplateColumns: '1fr 1fr 1fr',
                  }}
                >
                  <IconButton className="controls_icons" aria-label="reqind">
                    <FastRewind style={{color: theme.palette.text.secondary}} />
                  </IconButton>
                  <IconButton
                    className="controls_icons"
                    aria-label="reqind"
                    onClick={playButtonHandler}
                  >
                    {!playing ? (
                      <PlayArrowSharp
                        style={{color: theme.palette.text.secondary}}
                      />
                    ) : (
                      <PauseSharp
                        style={{color: theme.palette.text.secondary}}
                      />
                    )}
                  </IconButton>

                  <IconButton className="controls_icons" aria-label="reqind">
                    <FastForwardSharp
                      style={{color: theme.palette.text.secondary}}
                    />
                  </IconButton>
                </Box>
              </Fade>
              {showFeatureSelection && (
                <IconButton
                  onClick={() => onFeatureSelect()}
                >
                  <FeatIcon
                    color={
                      hasFeatureSelectionFeedback
                        ? theme.palette.primary.main
                        : theme.palette.text.secondary
                    }
                  />
                </IconButton>
              )}
            </Box>
    </Box>
  );
};

export default VideoPlayer;