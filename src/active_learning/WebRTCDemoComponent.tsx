import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  Paper,
  Tabs,
  Tab,
  Divider,
  CircularProgress,
  IconButton,
  Tooltip,
} from '@mui/material';
import { Close, Fullscreen, FullscreenExit, KeyboardArrowDown, KeyboardArrowUp } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import { useWebRTC } from './useWebRTC';

interface WebRTCDemoComponentProps {
  sessionId: string;
  experimentId: string;
  environmentId: string;
  coordinate: { x: number; y: number };
  onSubmit: () => void;
  onCancel: () => void;
}

const WebRTCDemoComponent: React.FC<WebRTCDemoComponentProps> = ({
  sessionId,
  experimentId,
  environmentId,
  coordinate,
  onSubmit,
  onCancel,
}) => {
  const theme = useTheme();

  // State management
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [episodeDone, setEpisodeDone] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // WebRTC hook
  const { start, stop, logs, remoteStream, sendKeyDown, sendKeyUp, sendAction } = useWebRTC({
    sessionId,
    environmentId,
    experimentId,
    serverUrl: '/demo_generation/gym_offer'
  });

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!connected) return;

    const key = event.key.toLowerCase();
    sendKeyDown(key);

    // Increment step count for visual feedback
    setStepCount(prev => prev + 1);
    event.preventDefault();
  }, [connected, sendKeyDown]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!connected) return;

    const key = event.key.toLowerCase();
    sendKeyUp(key);
    event.preventDefault();
  }, [connected, sendKeyUp]);

  // Set up video stream when remoteStream changes
  useEffect(() => {
    if (remoteStream && videoRef.current) {
      console.log('Setting video stream');
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Initialize demo on mount - only run once
  useEffect(() => {
    let isMounted = true;

    const initDemo = async () => {
      if (!isMounted) return;
      
      setLoading(true);
      setError(null);

      try {
        await start({ useDataChannel: true });
        if (isMounted) {
          setConnected(true);
        }
      } catch (err) {
        if (isMounted) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMsg);
          console.error('Error initializing WebRTC:', err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initDemo();

    return () => {
      isMounted = false;
      stop();
    };
  }, []); // Empty dependency array - only run once

  // Retry function for error cases
  const handleRetry = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await start({ useDataChannel: true });
      setConnected(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error retrying WebRTC:', err);
    } finally {
      setLoading(false);
    }
  }, [start]);

  // Setup keyboard event listeners when connected
  useEffect(() => {
    if (connected) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [connected, handleKeyDown, handleKeyUp]);

  // Handle tab change
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!fullscreen) {
      if (containerRef.current?.requestFullscreen) {
        containerRef.current.requestFullscreen();
        setFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setFullscreen(false);
      }
    }
  }, [fullscreen]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard controls info - updated for Metaworld
  const keyboardControls = {
    'W/S': 'Forward/Backward (dx)',
    'A/D': 'Left/Right (dy)',
    'Shift/Ctrl': 'Up/Down (dz)',
    'Q/E': 'Gripper Open/Close',
  };

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        gap: 2
      }}>
        <CircularProgress />
        <Typography variant="body2">Initializing WebRTC demo session...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 1 }}>
        {error}
        <Button size="small" onClick={handleRetry} sx={{ ml: 1 }}>
          Retry
        </Button>
      </Alert>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: fullscreen ? '100vh' : '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: fullscreen ? 'black' : 'transparent',
        position: 'relative'
      }}
    >
      <Paper
        elevation={2}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: fullscreen ? 0 : 1,
          bgcolor: fullscreen ? 'black' : 'background.paper'
        }}
      >
        {/* Header with tabs and controls */}
        <Box sx={{ position: 'relative' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            centered
            variant="fullWidth"
            sx={{
              bgcolor: fullscreen ? 'rgba(0,0,0,0.8)' : 'background.paper',
              color: fullscreen ? 'white' : 'inherit'
            }}
          >
            <Tab label="Live Demo" sx={{ py: 0.5, minHeight: '36px' }} />
            <Tab label="Controls" sx={{ py: 0.5, minHeight: '36px' }} />
          </Tabs>

          {/* Fullscreen toggle */}
          <IconButton
            onClick={toggleFullscreen}
            sx={{
              position: 'absolute',
              top: 4,
              right: 40,
              color: fullscreen ? 'white' : 'inherit',
              zIndex: 10
            }}
            size="small"
          >
            {fullscreen ? <FullscreenExit /> : <Fullscreen />}
          </IconButton>

          {/* Controls visibility toggle */}
          {fullscreen && (
            <IconButton
              onClick={() => setControlsVisible(!controlsVisible)}
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                color: 'white',
                zIndex: 10
              }}
              size="small"
            >
              {controlsVisible ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
          )}
        </Box>

        <Divider />

        {/* Content area */}
        <Box sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: fullscreen ? (controlsVisible ? 1 : 0) : 1,
          bgcolor: fullscreen ? 'black' : 'transparent',
          overflow: 'auto', // Allow scrolling
          minHeight: 0 // Important for flex containers
        }}>
          {/* Always render video but hide when not on tab 0 */}
          <Box sx={{
            display: tabValue === 0 ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
            minHeight: 'fit-content' // Allow natural sizing
          }}>
            {/* Video stream display */}
            <Box sx={{
              position: 'relative',
              width: '100%',
              maxWidth: fullscreen ? '100%' : '600px',
              height: fullscreen ? '70vh' : '400px', // Fixed height instead of aspect ratio
              bgcolor: 'black',
              borderRadius: fullscreen ? 0 : 1,
              overflow: 'hidden',
              border: fullscreen ? 'none' : '1px solid',
              borderColor: 'divider'
            }}>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => {
                  console.log('Video metadata loaded');
                  if (videoRef.current) {
                    console.log('Video dimensions:', videoRef.current.videoWidth, 'x', videoRef.current.videoHeight);
                  }
                }}
                onLoadStart={() => console.log('Video load started')}
                onCanPlay={() => console.log('Video can play')}
                onPlaying={() => console.log('Video is playing')}
                onError={(e) => console.error('Video error:', e)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: 'black'
                }}
              />

              {/* Connection status overlay */}
              {!connected && (
                <Box sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(0,0,0,0.8)',
                  color: 'white'
                }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress color="inherit" size={24} />
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      Connecting to environment...
                    </Typography>
                  </Box>
                </Box>
              )}

              {/* Step counter */}
              {connected && !fullscreen && (
                <Box sx={{
                  position: 'absolute',
                  top: 8,
                  left: 8,
                  bgcolor: 'rgba(0,0,0,0.7)',
                  color: 'white',
                  px: 1,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: '0.75rem'
                }}>
                  Steps: {stepCount}
                </Box>
              )}
            </Box>

            {/* Status info */}
            {!fullscreen && (
              <Typography variant="caption" color="text.secondary">
                {connected ?
                  'Use keyboard to control the robot (WASD + Q/E + Shift/Ctrl)' :
                  'Waiting for connection...'
                }
              </Typography>
            )}
          </Box>

          {tabValue === 1 && (
            <Box sx={{ p: 1, color: fullscreen ? 'white' : 'inherit' }}>
              <Typography variant="h6" gutterBottom>Keyboard Controls</Typography>

              <Box sx={{ display: 'grid', gap: 1, mb: 2 }}>
                {Object.entries(keyboardControls).map(([keys, description]) => (
                  <Box key={keys} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {keys}
                    </Typography>
                    <Typography variant="body2">
                      {description}
                    </Typography>
                  </Box>
                ))}
              </Box>

              <Typography variant="caption" color="text.secondary">
                Environment: {environmentId}
              </Typography>
              <br />
              <Typography variant="caption" color="text.secondary">
                Coordinate: [{coordinate.x.toFixed(2)}, {coordinate.y.toFixed(2)}]
              </Typography>
            </Box>
          )}
        </Box>

        {/* Footer controls */}
        {(!fullscreen || controlsVisible) && (
          <>
            <Divider />
            <Box sx={{
              display: 'flex',
              justifyContent: 'space-between',
              p: 1,
              bgcolor: fullscreen ? 'rgba(0,0,0,0.8)' : 'background.paper'
            }}>
              <Button
                startIcon={<Close />}
                size="small"
                onClick={onCancel}
                sx={{ color: fullscreen ? 'white' : 'inherit' }}
              >
                Cancel
              </Button>

              <Button
                variant="contained"
                size="small"
                disabled={!connected}
                onClick={onSubmit}
              >
                Submit Demo
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default WebRTCDemoComponent;