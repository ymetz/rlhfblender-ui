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
import { useWebRTC } from './useWebRTC';
import { isBrowserMujocoEnvironment, isDashDrivingEnvironment, isMiniGridEnvironment, miniGridKeyActions } from './demoEnvironment';
import DashIframeDemoComponent from './DashIframeDemoComponent';
import BabyAIInput from '../custom_env_inputs/babyai_input';

const MujocoDemoComponent = React.lazy(() => import('./MujocoDemoComponent'));

export interface WebRTCFooterControls {
  connected: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: (payload?: Record<string, any>) => void | Promise<void>;
  reset: () => Promise<void>;
}

export interface WebRTCDemoComponentProps {
  sessionId: string;
  experimentId: string;
  environmentId: string;
  coordinate?: { x: number; y: number };
  checkpoint?: number;
  benchmarkId?: number;
  episodeNum?: number;
  step?: number;
  initialStateMode?: 'reset';
  initialCameraPreset?: 'corner-video';
  onSubmit: (payload?: Record<string, any>) => void | Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  footerContent?: (controls: WebRTCFooterControls) => React.ReactNode;
}

const WebRTCDemoComponent: React.FC<WebRTCDemoComponentProps> = ({
  sessionId,
  experimentId,
  environmentId,
  coordinate,
  checkpoint,
  benchmarkId,
  episodeNum,
  step,
  initialStateMode,
  initialCameraPreset,
  onSubmit,
  onCancel,
  isSubmitting = false,
  footerContent,
}) => {
  if (isBrowserMujocoEnvironment(environmentId)) {
    return (
      <React.Suspense fallback={<CircularProgress size={24} />}>
        <MujocoDemoComponent
          sessionId={sessionId}
          experimentId={experimentId}
          environmentId={environmentId}
          coordinate={coordinate}
          checkpoint={checkpoint}
          benchmarkId={benchmarkId}
          episodeNum={episodeNum}
          step={step}
          initialStateMode={initialStateMode}
          initialCameraPreset={initialCameraPreset}
          onSubmit={onSubmit}
          onCancel={onCancel}
          isSubmitting={isSubmitting}
          footerContent={footerContent}
        />
      </React.Suspense>
    );
  }

  if (isDashDrivingEnvironment(environmentId)) {
    return (
      <DashIframeDemoComponent
        sessionId={sessionId}
        experimentId={experimentId}
        environmentId={environmentId}
        coordinate={coordinate}
        checkpoint={checkpoint}
        episodeNum={episodeNum}
        step={step}
        onSubmit={onSubmit}
        onCancel={onCancel}
        isSubmitting={isSubmitting}
        footerContent={footerContent}
      />
    );
  }

  return <StreamedDemoComponent
    sessionId={sessionId} experimentId={experimentId} environmentId={environmentId}
    coordinate={coordinate} checkpoint={checkpoint} episodeNum={episodeNum} step={step}
    onSubmit={onSubmit} onCancel={onCancel} isSubmitting={isSubmitting} footerContent={footerContent}
  />;
};

const StreamedDemoComponent: React.FC<WebRTCDemoComponentProps> = ({
  sessionId, experimentId, environmentId, coordinate, checkpoint, episodeNum, step,
  onSubmit, onCancel, isSubmitting = false, footerContent,
}) => {
  const isMiniGrid = isMiniGridEnvironment(environmentId);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // WebRTC hook
  const { start, stop, connected, episodeStatus, remoteStream, sendKeyDown, sendKeyUp, sendAction } = useWebRTC({
    sessionId,
    environmentId,
    experimentId,
    coordinate,
    checkpoint,
    episodeNum,
    step,
    serverUrl: '/demo_generation/gym_offer'
  });
  const episodeDone = episodeStatus?.done ?? false;
  const stepCount = episodeStatus?.step_count ?? 0;

  const takeAction = useCallback((action: number) => {
    if (!connected || episodeDone || isSubmitting) return;
    sendAction(action);
  }, [connected, episodeDone, isSubmitting, sendAction]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!connected || episodeDone || isSubmitting || event.metaKey || event.altKey || (isMiniGrid && event.ctrlKey)) return;
    if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;

    const key = event.key.toLowerCase();
    if (isMiniGrid) {
      const action = miniGridKeyActions[key];
      if (action === undefined) return;
      event.preventDefault();
      if (!event.repeat) takeAction(action);
      return;
    }
    sendKeyDown(key);

    event.preventDefault();
  }, [connected, episodeDone, isSubmitting, isMiniGrid, sendKeyDown, takeAction]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!connected || isMiniGrid) return;

    const key = event.key.toLowerCase();
    sendKeyUp(key);
    event.preventDefault();
  }, [connected, isMiniGrid, sendKeyUp]);

  // Set up video stream when remoteStream changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = remoteStream ?? null;
    }
  }, [remoteStream, loading]);

  const coordinateKey = coordinate ? `${coordinate.x},${coordinate.y}` : 'none';
  const startRef = useRef(start);
  const stopRef = useRef(stop);

  useEffect(() => {
    startRef.current = start;
  }, [start]);

  useEffect(() => {
    stopRef.current = stop;
  }, [stop]);

  const endRemoteSession = useCallback(async () => {
    try {
      await fetch('/demo_generation/end_demo_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, webrtc_enabled: true }),
      });
    } catch (err) {
      console.error('Error ending WebRTC demo session:', err);
    }
  }, [sessionId]);

  // Initialize or re-initialize demo whenever key parameters change
  useEffect(() => {
    let isActive = true;

    setLoading(true);
    setError(null);

    const initDemo = async () => {
      try {
        await endRemoteSession();
        if (!isActive) return;
        await startRef.current?.({ useDataChannel: true });
      } catch (err) {
        if (isActive) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          setError(errorMsg);
          console.error('Error initializing WebRTC:', err);
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    void initDemo();

    return () => {
      isActive = false;
      stopRef.current?.();
      void endRemoteSession();
    };
  }, [sessionId, experimentId, environmentId, coordinateKey, checkpoint, episodeNum, step, endRemoteSession]);

  // Retry function for error cases
  const handleRetry = useCallback(async () => {
    setLoading(true);
    setError(null);

    stop();

    try {
      await endRemoteSession();
      await start({ useDataChannel: true });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error retrying WebRTC:', err);
    } finally {
      setLoading(false);
    }
  }, [start, stop, endRemoteSession]);

  // Setup keyboard event listeners when connected
  useEffect(() => {
    if (connected && !episodeDone) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [connected, episodeDone, handleKeyDown, handleKeyUp]);

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
  const keyboardControls = isMiniGrid ? {
    '←/A, →/D': 'Turn left/right',
    '↑/W': 'Move forward',
    'PageUp/Q': 'Pick up',
    'PageDown/E': 'Drop',
    'Space': 'Toggle door/object',
    'Enter': 'Done',
  } : {
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
        <Button size="small" onClick={onCancel}>Cancel</Button>
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
        <Button size="small" onClick={onCancel}>Cancel</Button>
      </Alert>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        width: '100%',
        height: fullscreen ? '100vh' : '100%',
        minHeight: 0,
        minWidth: 0,
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
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRadius: fullscreen ? 0 : 1,
          bgcolor: fullscreen ? 'black' : 'background.paper'
        }}
      >
        {/* Header with tabs and controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            centered
            variant="fullWidth"
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 40,
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
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            sx={{
              color: fullscreen ? 'white' : 'inherit',
              mx: 0.5,
            }}
            size="small"
          >
            {fullscreen ? <FullscreenExit /> : <Fullscreen />}
          </IconButton>

          {/* Controls visibility toggle */}
          {fullscreen && (
            <IconButton
              onClick={() => setControlsVisible(!controlsVisible)}
              aria-label={controlsVisible ? 'Hide controls' : 'Show controls'}
              sx={{
                color: 'white',
                mr: 0.5,
              }}
              size="small"
            >
              {controlsVisible ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
            </IconButton>
          )}
        </Box>

        <Divider />

        {episodeDone && (
          <Alert
            severity="info"
            sx={{ flexShrink: 0 }}
            action={<Button disabled={isSubmitting} onClick={handleRetry}>Restart</Button>}
          >
            {episodeStatus?.truncated ? 'Episode reached its time limit.' : 'Episode finished.'}
            {' '}Submit this demo or restart.
          </Alert>
        )}

        {/* Content area */}
        <Box sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          p: fullscreen ? (controlsVisible ? 1 : 0) : 1,
          bgcolor: fullscreen ? 'black' : 'transparent',
          overflow: 'hidden',
          minHeight: 0,
        }}>
          {/* Always render video but hide when not on tab 0 */}
          <Box sx={{
            display: tabValue === 0 ? 'flex' : 'none',
            flexDirection: 'column',
            alignItems: 'center',
            flex: 1,
            gap: 1,
            minHeight: 0,
          }}>
            {/* Video stream display */}
            <Box role="region" aria-label="Live environment" sx={{
              position: 'relative',
              width: '100%',
              flex: '1 1 300px',
              minHeight: 0,
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
                onError={(e) => console.error('Video error:', e)}
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'block',
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

            {(!fullscreen || controlsVisible) && (!episodeDone || isMiniGrid) && (
              <Box
                role="region"
                aria-label="Demo controls"
                tabIndex={0}
                sx={{
                  width: '100%',
                  flexShrink: 0,
                  maxHeight: '32%',
                  overflowY: 'auto',
                  overscrollBehavior: 'contain',
                  scrollbarGutter: 'stable',
                }}
              >
                {!episodeDone && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mb: 1 }}>
                    {connected ?
                      (isMiniGrid ? 'Use the buttons or arrow keys to act one step at a time.' : 'Use keyboard to control the robot (WASD + Q/E + Shift/Ctrl)') :
                      'Waiting for connection...'
                    }
                  </Typography>
                )}
                {isMiniGrid && (
                  <Box component="fieldset" disabled={!connected || episodeDone || isSubmitting} sx={{ border: 0, minWidth: 0, m: 0, p: 0.5 }}>
                    <BabyAIInput setFeedback={takeAction} />
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {tabValue === 1 && (
            <Box sx={{ p: 1, overflowY: 'auto', minHeight: 0, color: fullscreen ? 'white' : 'inherit' }}>
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
              {coordinate && (
                <Typography variant="caption" color="text.secondary">
                  Coordinate: [{coordinate.x.toFixed(2)}, {coordinate.y.toFixed(2)}]
                </Typography>
              )}
              {episodeNum !== undefined && step !== undefined && (
                <Typography variant="caption" color="text.secondary">
                  Episode {episodeNum}, Step {step}
                </Typography>
              )}
            </Box>
          )}
        </Box>

        {/* Footer controls */}
        {(!fullscreen || controlsVisible) && (
          <>
            <Divider />
            <Box
              sx={{
                display: 'flex',
                flexShrink: 0,
                justifyContent: 'space-between',
                p: 1,
                bgcolor: fullscreen ? 'rgba(0,0,0,0.8)' : 'background.paper',
                alignItems: 'center',
                gap: 1,
                flexWrap: 'wrap'
              }}
            >
              {footerContent ? (
                footerContent({
                  connected,
                  isSubmitting,
                  onCancel,
                  onSubmit,
                  reset: handleRetry,
                })
              ) : (
                <>
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
                    disabled={!connected || isSubmitting}
                    onClick={() => {
                      void onSubmit();
                    }}
                  >
                    {isSubmitting && (
                      <CircularProgress size={16} sx={{ mr: 1 }} color="inherit" />
                    )}
                    Submit Demo
                  </Button>
                </>
              )}
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default WebRTCDemoComponent;
