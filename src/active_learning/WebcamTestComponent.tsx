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
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { Close, Fullscreen, FullscreenExit, KeyboardArrowDown, KeyboardArrowUp, Camera } from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';

interface CameraInfo {
  id: number;
  width: number;
  height: number;
  fps: number;
  name: string;
}

interface WebRTCDemoComponentProps {
  sessionId: string;
  experimentId?: string;
  environmentId?: string;
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
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  
  // Camera-specific state
  const [availableCameras, setAvailableCameras] = useState<CameraInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<number>(0);
  const [useTestPattern, setUseTestPattern] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<string>('disconnected');

  // WebRTC refs
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load available cameras
  const loadCameras = useCallback(async () => {
    try {
      const response = await fetch('/data/list_cameras');
      const data = await response.json();
      
      setAvailableCameras(data.cameras || []);
      if (data.default_camera !== null) {
        setSelectedCamera(data.default_camera);
      }
    } catch (err) {
      console.error('Failed to load cameras:', err);
    }
  }, []);

  // Initialize camera streaming
  const initializeCameraStream = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      await setupWebRTC();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error initializing camera stream:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCamera, useTestPattern]);

  // Setup WebRTC peer connection
  const setupWebRTC = useCallback(async () => {
    try {
      // Create peer connection
      const pc = new RTCPeerConnection({
        sdpSemantics: 'unified-plan',
        iceServers: [], // No external ICE servers for localhost
        iceCandidatePoolSize: 0,
        iceTransportPolicy: 'all',
        rtcpMuxPolicy: 'require'
      });

      peerConnectionRef.current = pc;
      
      // Handle incoming video stream
      pc.ontrack = (event) => {
        console.log('Received remote stream');
        const track = event.track;
        
        track.enabled = true;
        
        track.onmute = () => {
          console.warn('Track was muted! Attempting to unmute...');
          track.enabled = true;
        };
        
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          console.log('Video element src set');
        }
      };

      // Handle data channel for control messages
      pc.ondatachannel = (event) => {
        const channel = event.channel;
        
        channel.onopen = () => {
          console.log('Data channel opened');
        };

        channel.onmessage = (event) => {
          console.log('Data channel message:', event.data);
        };
      };

      // Connection state monitoring
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        setCameraStatus(pc.connectionState);
        
        if (pc.connectionState === 'connected') {
          setConnected(true);
          console.log('WebRTC connection established successfully');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnected(false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
      };

      // Add transceiver for receiving video
      pc.addTransceiver('video', { direction: 'recvonly' });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      console.log('Local description set');

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          const checkState = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', checkState);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', checkState);
        }
      });

      console.log('Sending offer to server with camera settings');
      
      // Send offer to server with camera configuration
      const response = await fetch('/data/gym_offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: offer.sdp,
          type: offer.type,
          session_id: sessionId,
          experiment_id: experimentId,
          environment_id: environmentId,
          camera_id: selectedCamera,
          use_test_pattern: useTestPattern,
        }),
      });

      const result = await response.json();
      console.log('Camera offer result:', result);
      
      if (result.sdp) {
        const answer = new RTCSessionDescription({
          type: result.type,
          sdp: result.sdp,
        });

        await pc.setRemoteDescription(answer);
        console.log('Remote description set');
      } else {
        throw new Error('No SDP answer received from server');
      }

    } catch (err) {
      console.error('Error setting up WebRTC:', err);
      setError('Failed to setup camera connection');
    }
  }, [sessionId, experimentId, environmentId, selectedCamera, useTestPattern]);

  // Send control message to server
  const sendControlMessage = useCallback(async (command: string, params: any = {}) => {
    try {
      const response = await fetch('/data/camera_control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          command,
          params,
        }),
      });

      const result = await response.json();
      return result;
    } catch (err) {
      console.error('Failed to send control message:', err);
    }
  }, [sessionId]);

  // Get camera status
  const getCameraStatus = useCallback(async () => {
    const result = await sendControlMessage('get_status');
    if (result?.success) {
      setCameraStatus(result.status.connection_state);
    }
  }, [sendControlMessage]);

  // Cleanup function
  const cleanup = useCallback(async () => {
    // Close WebRTC connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Close camera session on server
    try {
      await fetch('/data/close_camera_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      });
    } catch (err) {
      console.error('Error closing camera session:', err);
    }
  }, [sessionId]);

  // Initialize on mount
  useEffect(() => {
    let isMounted = true;

    const initComponent = async () => {
      if (isMounted) {
        await loadCameras();
        await initializeCameraStream();
      }
    };

    initComponent();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []);

  // Reinitialize when camera settings change
  useEffect(() => {
    if (!loading) {
      initializeCameraStream();
    }
  }, [selectedCamera, useTestPattern]);

  // Periodic status check
  useEffect(() => {
    if (connected) {
      const interval = setInterval(getCameraStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [connected, getCameraStatus]);

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
        <Typography variant="body2">Initializing camera stream...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 1 }}>
        {error}
        <Button size="small" onClick={initializeCameraStream} sx={{ ml: 1 }}>
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
            <Tab label="Camera Stream" sx={{ py: 0.5, minHeight: '36px' }} />
            <Tab label="Camera Settings" sx={{ py: 0.5, minHeight: '36px' }} />
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
          bgcolor: fullscreen ? 'black' : 'transparent'
        }}>
          {tabValue === 0 && (
            <Box sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1
            }}>
              {/* Video stream */}
              <Box sx={{
                position: 'relative',
                width: '100%',
                maxWidth: fullscreen ? '100%' : '800px',
                aspectRatio: '4/3',
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
                        Connecting to camera...
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Status indicator */}
                {!fullscreen && (
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
                    Status: {cameraStatus}
                  </Box>
                )}
              </Box>

              {/* Camera info */}
              {!fullscreen && connected && (
                <Typography variant="caption" color="text.secondary">
                  Camera {selectedCamera} - {useTestPattern ? 'Test Pattern' : 'Live Feed'}
                </Typography>
              )}
            </Box>
          )}

          {tabValue === 1 && (
            <Box sx={{ p: 1, color: fullscreen ? 'white' : 'inherit' }}>
              <Typography variant="h6" gutterBottom>Camera Settings</Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
                {/* Camera selection */}
                <FormControl fullWidth size="small">
                  <InputLabel>Camera</InputLabel>
                  <Select
                    value={selectedCamera}
                    label="Camera"
                    onChange={(e) => setSelectedCamera(Number(e.target.value))}
                    disabled={loading}
                  >
                    {availableCameras.map((camera) => (
                      <MenuItem key={camera.id} value={camera.id}>
                        {camera.name} ({camera.width}x{camera.height})
                      </MenuItem>
                    ))}
                    <MenuItem value={-1}>No Camera (Test Pattern Only)</MenuItem>
                  </Select>
                </FormControl>

                {/* Test pattern toggle */}
                <FormControlLabel
                  control={
                    <Switch
                      checked={useTestPattern}
                      onChange={(e) => setUseTestPattern(e.target.checked)}
                      disabled={loading}
                    />
                  }
                  label="Use Test Pattern"
                />

                {/* Refresh cameras button */}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<Camera />}
                  onClick={loadCameras}
                  disabled={loading}
                >
                  Refresh Cameras
                </Button>
              </Box>

              {/* Info */}
              <Typography variant="caption" color="text.secondary">
                Session: {sessionId}
              </Typography>
              <br />
              <Typography variant="caption" color="text.secondary">
                Available Cameras: {availableCameras.length}
              </Typography>
              {coordinate && (
                <>
                  <br />
                  <Typography variant="caption" color="text.secondary">
                    Coordinate: [{coordinate.x.toFixed(2)}, {coordinate.y.toFixed(2)}]
                  </Typography>
                </>
              )}
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

              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={!connected}
                  onClick={() => sendControlMessage('take_screenshot')}
                  sx={{ color: fullscreen ? 'white' : 'inherit' }}
                >
                  Screenshot
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
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default WebRTCDemoComponent;