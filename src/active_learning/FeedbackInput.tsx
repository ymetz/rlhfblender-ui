import {
  Box,
  Typography,
  Button,
  Slider,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Alert,
  Paper,
  Grid,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useTheme } from '@mui/material/styles';
import { ThumbDown, ThumbUp, PlayArrow, Send } from '@mui/icons-material';
import * as d3 from 'd3';
import axios from 'axios';

import { useAppState, useAppDispatch } from '../AppStateContext';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import { FeedbackType, Feedback, Episode } from '../types';
import { IDfromEpisode } from "../id";
import { useGetter } from "../getter-context";
import { getEpisodeColor as getEpisodeColorFromUtil } from './utils/trajectoryColors';
import WebRTCDemoComponent from './WebRTCDemoComponent';

// Helper function to map feedback type to category
const getFeedbackCategory = (feedbackType: FeedbackType, selectionType?: string): string => {
  switch (feedbackType) {
    case FeedbackType.Evaluative:
      return selectionType === 'cluster' ? 'Cluster' : 'Rating';
    case FeedbackType.Comparative:
      return 'Comparison';
    case FeedbackType.Corrective:
      return 'Correction';
    case FeedbackType.Demonstrative:
      return 'Demo';
    default:
      return 'Rating';
  }
};

const FeedbackInput = () => {
  const theme = useTheme();
  const { sessionId, episodeIDsChronologically, selectedExperiment } = useAppState();
  const appDispatch = useAppDispatch();
  const activeState = useActiveLearningState();
  const activeDispatch = useActiveLearningDispatch();
  const { getVideoURL } = useGetter();

  // Local state
  const selection = activeState.selection || [];
  const [value, setValue] = useState(5);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [videoURLs, setVideoURLs] = useState<Map<string, string>>(new Map());
  const [currentPlaying, setCurrentPlaying] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  
  // Demo specific state
  const [useWebRTC, setUseWebRTC] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // When the component mounts, auto-fit content
  useEffect(() => {
    if (containerRef.current) {
      // Set initial height based on container
      const containerHeight = containerRef.current.clientHeight;
      console.log("Container height:", containerHeight);
    }
  }, []);

  // Reset state when selection changes
  useEffect(() => {
    setValue(5);
    setChosenId(null);
    setSubmitted(false);
    setCorrectionText('');
    setUseWebRTC(false);
  }, [selection]);

  // Extract selection type and data
  const selectionData = useMemo(() => {
    if (selection.length === 0) return { type: 'none', data: [] };
    if (selection.length === 1) {
      const item = selection[0];
      return { type: item.type, data: [item.data] };
    }
    // For multiple selections, check if all are trajectories
    const allTrajectories = selection.every(item => item.type === 'trajectory');
    if (allTrajectories) {
      return { type: 'multi_trajectory', data: selection.map(item => item.data) };
    }
    return { type: 'mixed', data: selection };
  }, [selection]);

  // Fetch video URLs for trajectories
  useEffect(() => {
    if (selectionData.type === 'trajectory' || selectionData.type === 'multi_trajectory') {
      const fetchVideos = async () => {
        setLoading(true);
        const newVideoURLMap = new Map<string, string>();
        
        for (const idx of selectionData.data) {
          if (typeof idx === 'number' && episodeIDsChronologically[idx]) {
            const episode = episodeIDsChronologically[idx];
            const episodeID = IDfromEpisode(episode);
            try {
              const url = await getVideoURL(episodeID);
              newVideoURLMap.set(episodeID, url);
            } catch (error) {
              console.error("Error fetching video:", error);
            }
          }
        }
        
        setVideoURLs(newVideoURLMap);
        setLoading(false);
      };
      
      fetchVideos();
    }
  }, [selectionData, episodeIDsChronologically, getVideoURL]);

  // Generate proper target based on selection type
  const createTarget = (selectionType: string, data: any, step?: number) => {
    switch (selectionType) {
      case 'trajectory':
        const episode = episodeIDsChronologically[data];
        const episodeId = IDfromEpisode(episode);
        return {
          target_id: episodeId,
          reference: episode,
          origin: "online",
          timestamp: Date.now(),
        };
      case 'state':
        // For state-level feedback, we need to identify which episode and step this state belongs to
        // This is a coordinate in the projection space, so we'll use a generic format
        return {
          target_id: `state_${data[0]}_${data[1]}`,
          reference: null, // No specific episode reference for projection coordinates
          origin: "online", 
          timestamp: Date.now(),
          step: step,
        };
      case 'cluster':
        return {
          target_id: `cluster_${data}`,
          reference: null, // Clusters don't map to specific episodes
          origin: "online",
          timestamp: Date.now(),
        };
      case 'coordinate':
        return {
          target_id: `coordinate_${data.x}_${data.y}`,
          reference: null, // Coordinates are projection space points
          origin: "online",
          timestamp: Date.now(),
        };
      default:
        return {
          target_id: `unknown_${Date.now()}`,
          reference: null,
          origin: "online",
          timestamp: Date.now(),
        };
    }
  };

  // Submit feedback to the system
  const submitFeedback = async (fb: Feedback) => {
    // Schedule feedback for the session
    appDispatch({ type: 'SCHEDULE_FEEDBACK', payload: fb });
    
    // Also immediately submit to backend
    try {
      await axios.post("/data/give_feedback", [fb]);
      console.log("Feedback submitted successfully:", fb);
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
    
    // Update feedback counts in ActiveLearningContext
    const category = getFeedbackCategory(fb.feedback_type, 
      fb.feedback_type === FeedbackType.Evaluative ? selectionData.type : undefined);
    
    activeDispatch({ 
      type: 'UPDATE_FEEDBACK_COUNT', 
      payload: { category, isCurrentSession: true } 
    });
    
    setSubmitted(true);
    setTimeout(() => activeDispatch({ type: 'SET_SELECTION', payload: [] }), 1500);
  };

  // Handle rating submission
  const handleRate = () => {
    const target = createTarget(selectionData.type, selectionData.data[0]);
    const fb: Feedback = {
      feedback_type: FeedbackType.Evaluative,
      targets: [target],
      granularity: selectionData.type === 'state' ? 'state' : 'episode',
      timestamp: Date.now(),
      session_id: sessionId,
      score: value
    };
    submitFeedback(fb);
  };

  // Handle comparison submission
  const handleComparison = () => {
    const targets = selectionData.data.map(data => createTarget('trajectory', data));
    
    const fb: Feedback = {
      feedback_type: FeedbackType.Comparative,
      targets: targets,
      preferences: targets.map(target => target.target_id === chosenId ? 1 : 0),
      granularity: 'episode',
      timestamp: Date.now(),
      session_id: sessionId
    };
    submitFeedback(fb);
  };

  // Handle correction submission
  const handleCorrect = () => {
    const target = createTarget(selectionData.type, selectionData.data[0]);
    const fb: Feedback = {
      feedback_type: FeedbackType.Corrective,
      targets: [target],
      granularity: 'state',
      timestamp: Date.now(),
      session_id: sessionId,
      correction: correctionText
    };
    submitFeedback(fb);
  };


  const submitDemo = () => {
    const demoEpisode: Episode = {
      env_name: selectedExperiment.env_id,
      benchmark_type: "generated",
      benchmark_id: -1,
      checkpoint_step: -1,
      episode_num: Date.now(), // Use timestamp as episode number for WebRTC demos
    };
    
    const fb: Feedback = {
      feedback_type: FeedbackType.Demonstrative,
      targets: [
        {
          target_id: IDfromEpisode(demoEpisode),
          reference: demoEpisode,
          origin: "online",
          timestamp: Date.now(),
        },
      ],
      granularity: "episode",
      timestamp: Date.now(),
      session_id: sessionId,
    };
    
    submitFeedback(fb);
  };

  // Cleanup function to reset state when component unmounts
  useEffect(() => {
    return () => {
      // Clean up video URLs
      Array.from(videoURLs.values()).forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [videoURLs]);

  // Color generator for trajectory items
  const getEpisodeColor = useCallback((episodeIdx: number) => {
    // Use the shared color utility with fallback to d3 interpolation
    const color = getEpisodeColorFromUtil(episodeIdx, activeState.trajectoryColors, false);
    if (color !== '#888888') {
      return color;
    }
    
    // Fallback to original color scheme if no similarity color is available
    return d3.interpolateCool(episodeIdx / Math.max(1, episodeIDsChronologically.length - 1));
  }, [episodeIDsChronologically.length, activeState.trajectoryColors]);

  // Get video element for an episode
  const getVideoElement = (episode: Episode, index: number, small = false) => {
    const episodeId = IDfromEpisode(episode);
    const videoUrl = videoURLs.get(episodeId);
    
    return (
      <Box 
        sx={{ 
          position: 'relative',
          width: '100%',
          border: `3px solid ${getEpisodeColor(index)}`,
          borderRadius: 1,
          overflow: 'hidden',
          aspectRatio: '16/9', // Fixed aspect ratio for consistent sizing
          margin: '0 auto', // Center the video container
          maxWidth: small ? '200px' : '300px', // Limit maximum width
        }}
      >
        {videoUrl ? (
          <>
            <video
              src={videoUrl}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }} // Changed to 'contain' to prevent stretching
              muted
              autoPlay={currentPlaying === index}
              loop={currentPlaying === index}
              ref={el => {
                if (el && currentPlaying === index) {
                  el.play().catch(e => console.error("Video play error:", e));
                }
              }}
            />
            <IconButton 
              size="small" // Smaller button
              sx={{ 
                position: 'absolute',
                bottom: 4,
                right: 4,
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
                padding: '4px', // Less padding for the button
              }}
              onClick={() => setCurrentPlaying(currentPlaying === index ? null : index)}
            >
              <PlayArrow fontSize="small" />
            </IconButton>
          </>
        ) : (
          <Box sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100%',
            bgcolor: 'rgba(0,0,0,0.05)'
          }}>
            {loading ? <CircularProgress size={24} /> : "No video available"}
          </Box>
        )}
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 4,
            left: 4,
            backgroundColor: getEpisodeColor(index),
            color: 'white',
            borderRadius: 1,
            px: 1,
            py: 0.3, // Reduced padding
            fontSize: '0.7rem', // Smaller font
          }}
        >
          Episode {episode.episode_num}
        </Box>
      </Box>
    );
  };


  // Render different interfaces based on selection type
  const renderFeedbackInterface = () => {
    if (submitted) {
      return (
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          height: '100%'
        }}>
          <Alert 
            severity="success" 
            sx={{ 
              width: '90%', 
              '& .MuiAlert-message': { 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
              }
            }}
          >
            Feedback submitted successfully!
          </Alert>
        </Box>
      );
    }

    switch (selectionData.type) {
      case 'none':
        return (
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            height: '100%'
          }}>
            <Typography variant="body2" color="text.secondary" align="center">
              Select items from the visualization to provide feedback
            </Typography>
          </Box>
        );

      case 'trajectory':
        const episode = episodeIDsChronologically[selectionData.data[0]];
        
        return (
          <Box sx={{ overflow: 'hidden' }}> {/* Fixed height constraint */}
            <Typography variant="h6" gutterBottom>Rate this trajectory</Typography>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              {episode && getVideoElement(episode, selectionData.data[0])}
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <ThumbDown 
                sx={{ cursor: 'pointer', mr: 1 }} 
                fontSize="small"
                onClick={() => setValue(v => Math.max(0, v-1))} 
              />
              <Slider
                value={value}
                min={0}
                max={10}
                step={1}
                marks
                size="small"
                valueLabelDisplay="auto"
                onChange={(_, v) => setValue(v as number)}
                sx={{ mx: 1 }}
              />
              <ThumbUp 
                sx={{ cursor: 'pointer', ml: 1 }} 
                fontSize="small"
                onClick={() => setValue(v => Math.min(10, v+1))} 
              />
              <Typography variant="body2" sx={{ ml: 1, minWidth: '30px', textAlign: 'center' }}>{value}/10</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button variant="contained" size="small" onClick={handleRate}>
                Submit Rating
              </Button>
            </Box>
          </Box>
        );

      case 'multi_trajectory':
        return (
          <Box sx={{ overflow: 'hidden' }}> {/* Fixed height container with no scroll */}
            <Typography variant="h6" gutterBottom>Select the best episode</Typography>
            
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'row', 
              gap: 2, 
              justifyContent: 'center',
              overflowX: 'auto', // Horizontal scroll if needed
              pb: 1 // Add padding for scrollbar
            }}>
              {selectionData.data.map((trajectoryIdx, i) => {
                if (typeof trajectoryIdx !== 'number') return null;
                
                const episode = episodeIDsChronologically[trajectoryIdx];
                if (!episode) return null;
                
                const target = createTarget('trajectory', trajectoryIdx);
                const id = target.target_id;
                
                return (
                  <Box key={i} sx={{ 
                    minWidth: '180px', 
                    maxWidth: '220px',
                    flex: '1 0 auto' 
                  }}>
                    <Paper
                      elevation={chosenId === id ? 3 : 1}
                      sx={{
                        p: 1,
                        border: chosenId === id ? `2px solid ${theme.palette.primary.main}` : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          transform: 'translateY(-2px)',
                          boxShadow: 2
                        },
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                      onClick={() => setChosenId(id)}
                    >
                      {getVideoElement(episode, trajectoryIdx, true)}
                      <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                        <Radio 
                          checked={chosenId === id}
                          onChange={() => setChosenId(id)}
                          size="small"
                          sx={{ p: 0.5 }}
                        />
                        <Typography variant="body2" sx={{ ml: 1 }}>
                          Select #{episode.episode_num}
                        </Typography>
                      </Box>
                    </Paper>
                  </Box>
                );
              })}
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button 
                variant="contained" 
                onClick={handleComparison} 
                disabled={!chosenId}
                size="small"
              >
                Submit Selection
              </Button>
            </Box>
          </Box>
        );

      case 'state':
        const stateData = selectionData.data[0];
        
        return (
          <Box sx={{ overflow: 'auto' }}> {/* Allow scrolling if needed but limit height */}
            <Typography variant="h6" gutterBottom>Provide state correction</Typography>
            <Paper
              elevation={2}
              sx={{
                p: 1.5,
                mb: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                bgcolor: 'background.paper'
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                State coordinates: [{stateData[0].toFixed(2)}, {stateData[1].toFixed(2)}]
              </Typography>
              
              <TextField
                fullWidth
                multiline
                rows={2} // Reduced number of rows
                placeholder="Describe what the agent should do differently in this state..."
                value={correctionText}
                onChange={e => setCorrectionText(e.target.value)}
                variant="outlined"
                size="small"
                sx={{ my: 1 }}
              />
              
              <Button
                variant="contained"
                size="small"
                endIcon={<Send />}
                onClick={handleCorrect}
                disabled={!correctionText.trim()}
              >
                Submit Correction
              </Button>
            </Paper>
          </Box>
        );

      case 'cluster':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Rate this cluster of states</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
              <ThumbDown 
                sx={{ cursor: 'pointer', mr: 2 }} 
                onClick={() => setValue(v => Math.max(0, v-1))} 
              />
              <Slider
                value={value}
                min={0}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
                onChange={(_, v) => setValue(v as number)}
                sx={{ mx: 2 }}
              />
              <ThumbUp 
                sx={{ cursor: 'pointer', ml: 2 }} 
                onClick={() => setValue(v => Math.min(10, v+1))} 
              />
              <Typography sx={{ ml: 2 }}>{value}/10</Typography>
            </Box>
            <Typography variant="caption" display="block" sx={{ mb: 2, textAlign: 'center' }}>
              Rating applies to all {selectionData.data.length} states in the cluster
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button variant="contained" onClick={handleRate}>
                Submit Cluster Rating
              </Button>
            </Box>
          </Box>
        );

      case 'coordinate':
        const coordinate = selectionData.data[0];
        
        return (
          <Box sx={{ overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom fontSize="0.95rem">
              Demo from [{coordinate.x.toFixed(2)}, {coordinate.y.toFixed(2)}]
            </Typography>
            
            {!useWebRTC ? (
              <Button 
                variant="contained" 
                onClick={() => setUseWebRTC(true)}
                disabled={loading}
                size="small"
                sx={{ mt: 1 }}
              >
                Start WebRTC Demo
              </Button>
            ) : (
              <WebRTCDemoComponent
                sessionId={sessionId}
                experimentId={selectedExperiment.id.toString()}
                environmentId={selectedExperiment.env_id}
                coordinate={coordinate}
                onSubmit={submitDemo}
                onCancel={() => setUseWebRTC(false)}
              />
            )}
          </Box>
        );

      default:
        return (
          <Typography>
            Unsupported selection type: {selectionData.type}
          </Typography>
        );
    }
  };

  return (
    <Box 
      ref={containerRef}
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        p: 1,
        overflow: 'hidden', // Prevent overall scrolling
        position: 'relative' // For proper child positioning
      }}
    >
      {loading && (
        <Box sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'rgba(255, 255, 255, 0.7)',
          zIndex: 10
        }}>
          <CircularProgress size={24} />
        </Box>
      )}
      {renderFeedbackInterface()}
    </Box>
  );
};

export default FeedbackInput;