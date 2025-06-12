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
import { io, Socket } from 'socket.io-client';

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
  const [demoData, setDemoData] = useState<any>(null);
  const [tabValue, setTabValue] = useState(0);
  const [stepCount, setStepCount] = useState(0);
  const [episodeDone, setEpisodeDone] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  // WebRTC and Socket.IO refs
  const socketRef = useRef<Socket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard state tracking
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const keyMappingsRef = useRef<{ [key: string]: any }>({});

  // Initialize WebRTC demo session
  const initializeDemo = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Initialize demo session
      const response = await fetch('/data/initialize_webrtc_demo_session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          exp_id: experimentId,
          env_id: environmentId,
          seed: Math.floor(Math.random() * 1000),
          coordinate: [coordinate.x, coordinate.y],
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || 'Failed to initialize demo session');
      }

      setDemoData(data);
      keyMappingsRef.current = data.action_space || {};

      // Connect to WebRTC signaling server
      await connectToSignalingServer();

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMsg);
      console.error('Error initializing demo:', err);
    } finally {
      setLoading(false);
    }
  }, [sessionId, experimentId, environmentId, coordinate]);

  // Skip Socket.IO for now - use simplified WebRTC setup
  const connectToSignalingServer = useCallback(async () => {
    try {
      // For now, just setup WebRTC directly without Socket.IO
      setupWebRTC();
    } catch (err) {
      console.error('Failed to setup WebRTC:', err);
      setError('Failed to setup WebRTC');
    }
  }, []);

  // Setup WebRTC peer connection
  const setupWebRTC = useCallback(async () => {
    try {
      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      peerConnectionRef.current = pc;

      // Handle incoming media stream
      pc.ontrack = (event) => {
        console.log('Received remote stream:', event.streams.length, 'streams');
        console.log('Stream tracks:', event.streams[0]?.getTracks().length);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setConnected(true);
          console.log('Video source set successfully');
        } else {
          console.error('No video ref or stream available');
        }
      };

      // Handle data channel from remote peer
      pc.ondatachannel = (event) => {
        const channel = event.channel;
        dataChannelRef.current = channel;

        channel.onopen = () => {
          console.log('Data channel opened');
        };

        channel.onmessage = (event) => {
          // Handle incoming messages from server (if any)
          console.log('Data channel message:', event.data);
        };
      };

      // Handle connection state changes
      pc.onconnectionstatechange = () => {
        console.log('Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setConnected(true);
          console.log('WebRTC connection established successfully');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setConnected(false);
          console.log('WebRTC connection lost or failed');
        }
      };
      
      // Add ICE connection state logging
      pc.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', pc.iceConnectionState);
      };
      
      // Add gathering state logging
      pc.onicegatheringstatechange = () => {
        console.log('ICE gathering state:', pc.iceGatheringState);
      };

      // Create offer
      const offer = await pc.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: false,
      });

      await pc.setLocalDescription(offer);
      console.log('Local description set, sending offer to server');
      
      try {
        const response = await fetch('/data/webrtc_offer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            offer: offer.sdp,
          }),
        });

        console.log('WebRTC offer response status:', response.status);
        const result = await response.json();
        console.log('WebRTC offer result:', result);
        
        if (result.success && result.answer) {
          console.log('Received WebRTC answer, setting remote description');
          await handleWebRTCAnswer(result.answer);
        } else {
          throw new Error(result.error || 'Failed to get WebRTC answer');
        }
      } catch (err) {
        console.error('Failed to send WebRTC offer:', err);
        setError('Failed to establish WebRTC connection');
      }

    } catch (err) {
      console.error('Error setting up WebRTC:', err);
      setError('Failed to setup WebRTC connection');
    }
  }, [sessionId]);

  // Handle WebRTC answer from server
  const handleWebRTCAnswer = useCallback(async (answerSdp: string) => {
    try {
      if (!peerConnectionRef.current) return;

      const answer = new RTCSessionDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      await peerConnectionRef.current.setRemoteDescription(answer);
      console.log('Set remote description');

    } catch (err) {
      console.error('Error handling WebRTC answer:', err);
      setError('Failed to handle WebRTC answer');
    }
  }, []);

  // Send control message via HTTP instead of data channel
  const sendControlMessage = useCallback((message: any) => {
    // For now, send via HTTP endpoint instead of WebRTC data channel
    fetch('/data/webrtc_control', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        message: message,
      }),
    }).catch(err => {
      console.error('Failed to send control message:', err);
    });
  }, [sessionId]);

  // Handle keyboard events
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!connected) return;

    const key = event.key.toLowerCase();
    if (!pressedKeysRef.current.has(key)) {
      pressedKeysRef.current.add(key);
      sendControlMessage({ type: 'keydown', key });

      // Increment step count for visual feedback
      setStepCount(prev => prev + 1);
    }

    event.preventDefault();
  }, [connected, sendControlMessage]);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    if (!connected) return;

    const key = event.key.toLowerCase();
    if (pressedKeysRef.current.has(key)) {
      pressedKeysRef.current.delete(key);
      sendControlMessage({ type: 'keyup', key });
    }

    event.preventDefault();
  }, [connected, sendControlMessage]);

  // Cleanup function
  const cleanup = useCallback(async () => {
    // Remove keyboard listeners
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);

    // Close WebRTC connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Close Socket.IO connection
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    // Close demo session on server
    if (demoData) {
      try {
        await fetch('/data/end_demo_session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            webrtc_enabled: true,
          }),
        });
      } catch (err) {
        console.error('Error ending demo session:', err);
      }
    }
  }, [sessionId, demoData, handleKeyDown, handleKeyUp]);

  // Initialize demo on mount - only run once
  useEffect(() => {
    let isMounted = true;

    const initDemo = async () => {
      if (isMounted) {
        await initializeDemo();
      }
    };

    initDemo();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, []); // Empty dependency array - only run once

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
  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
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

  // Keyboard controls info
  const keyboardControls = {
    'W/A/S/D': 'Movement',
    'Q/E': 'Up/Down (3D)',
    'Space': 'Action/Gripper',
    'Enter': 'Done (BabyAI)',
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
        <Button size="small" onClick={initializeDemo} sx={{ ml: 1 }}>
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
                maxWidth: fullscreen ? '100%' : '600px',
                aspectRatio: '16/9',
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
                    'Use keyboard to control the environment (WASD + Space)' :
                    'Waiting for connection...'
                  }
                </Typography>
              )}
            </Box>
          )}

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