import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  IconButton,
  Paper,
  Button,
  Slider,
  Radio,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Image as ImageIcon,
  ThumbDown, 
  ThumbUp, 
  PlayArrow, 
  Send
} from '@mui/icons-material';
import { useAppState, useAppDispatch } from '../AppStateContext';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import * as d3 from 'd3';
import { IDfromEpisode } from "../id";
import { useGetter } from "../getter-context";
import { Episode, FeedbackType, Feedback } from '../types';
import { getEpisodeColor as getEpisodeColorFromUtil } from './utils/trajectoryColors';
import axios from 'axios';
import WebRTCDemoComponent from './WebRTCDemoComponent';
import { OnboardingHighlight, useOnboarding } from './OnboardingSystem';

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

const MergedSelectionFeedback = () => {
  const appState = useAppState();
  const appDispatch = useAppDispatch();
  const activeLearningState = useActiveLearningState();
  const activeLearningDispatch = useActiveLearningDispatch();
  const { getVideoURL } = useGetter();
  const { triggerStepComplete } = useOnboarding();

  // State for videos and interaction
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [videoURLs, setVideoURLs] = useState<Map<string, string>>(new Map<string, string>());
  const [clusterFrameImages, setClusterFrameImages] = useState<string[]>([]);
  const [stateFrameImage, setStateFrameImage] = useState<string | null>(null);
  
  // Feedback state
  const [value, setValue] = useState(5);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [loading, setLoading] = useState(false);
  const [useWebRTC, setUseWebRTC] = useState(false);
  const [currentPlaying, setCurrentPlaying] = useState<number | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Use selection directly from state
  const selection = useMemo(() => activeLearningState.selection || [], [activeLearningState.selection]);
  const allEpisodes = useMemo(() => appState.episodeIDsChronologically || [], [appState.episodeIDsChronologically]);

  // Extract selection type and data
  const selectionData = useMemo(() => {
    if (selection.length === 0) return { type: 'none', data: [] };
    if (selection.length === 1) {
      const item = selection[0];
      if (item.type === 'cluster')
        return { type: 'cluster', label: item.label, data: item.data };
      return { type: item.type, data: [item.data] };
    }
    const allTrajectories = selection.every(item => item.type === 'trajectory');
    if (allTrajectories) {
      return { type: 'multi_trajectory', data: selection.map(item => item.data) };
    }
    return { type: 'mixed', data: selection };
  }, [selection]);

  // Initialize videoRefs based on selection length
  useEffect(() => {
    videoRefs.current = Array(selection.length).fill(null);
  }, [selection.length]);

  // Reset feedback state when selection changes
  useEffect(() => {
    setValue(5);
    setChosenId(null);
    setSubmitted(false);
    setCorrectionText('');
    setUseWebRTC(false);
    setStateFrameImage(null);
  }, [selection]);

  // Fetch cluster frame images from backend
  const fetchClusterFrames = useCallback(async (clusterIndices: number[], episodeData: any[]) => {
    try {
      const response = await fetch('/data/get_cluster_frames', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cluster_indices: clusterIndices,
          episode_data: episodeData,
          max_states_to_show: 12
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch cluster frames');
      }
      
      const frameImages = await response.json();
      setClusterFrameImages(frameImages);
    } catch (error) {
      console.error('Error fetching cluster frames:', error);
      setClusterFrameImages([]);
    }
  }, []);

  // Fetch video URLs for trajectories
  useEffect(() => {
    if (selectionData.type === 'trajectory' || selectionData.type === 'multi_trajectory') {
      const fetchVideos = async () => {
        setLoading(true);
        const newVideoURLMap = new Map<string, string>();
        
        for (const idx of selectionData.data) {
          if (typeof idx === 'number' && allEpisodes[idx]) {
            const episode = allEpisodes[idx];
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
  }, [selectionData, allEpisodes, getVideoURL]);

  // Fetch cluster frame images when cluster is selected
  useEffect(() => {
    if (selectionData.type === 'cluster' && selectionData.data && selectionData.data.length > 0) {
      const episodeIndices = activeLearningState.episodeIndices;
      
      if (!episodeIndices || episodeIndices.length === 0) {
        console.warn('No episodeIndices available for cluster mapping');
        setClusterFrameImages([]);
        return;
      }
      
      if (!allEpisodes || allEpisodes.length === 0) {
        console.warn('No episodes available for cluster mapping');
        setClusterFrameImages([]);
        return;
      }
      
      let clusterIndices = selectionData.data;
      if (clusterIndices.length === 0) return;
      
      // Sample maxStatesToShow randomly to avoid too many images
      if (clusterIndices.length > 12) {
        const sampledIndices = d3.shuffle(clusterIndices).slice(0, 12);
        clusterIndices = sampledIndices;
      }
      
      // Map cluster indices to actual episode data using episodeIndices
      const episodeStepPairs = clusterIndices.map((stateIndex: number) => {
        const episodeNumber = episodeIndices[stateIndex];
        
        if (episodeNumber === undefined) {
          console.warn(`No episode mapping found for state index ${stateIndex}`);
          return null;
        }
        
        const episode = allEpisodes[episodeNumber];
        if (!episode) {
          console.warn(`Episode ${episodeNumber} not found in allEpisodes`);
          return null;
        }
        
        const episodeStart = episodeIndices.indexOf(episodeNumber);
        const stepWithinEpisode = stateIndex - episodeStart;
        
        return {
          stateIndex,
          episodeNumber,
          stepWithinEpisode,
          episode: {
            env_name: episode.env_name,
            benchmark_id: episode.benchmark_id,
            checkpoint_step: episode.checkpoint_step,
            episode_num: episode.episode_num,
          }
        };
      }).filter(Boolean);
      
      if (episodeStepPairs.length > 0) {
        const episodeData = episodeStepPairs.map(pair => pair.episode);
        const stepIndices = episodeStepPairs.map(pair => pair.stepWithinEpisode);
        
        fetchClusterFrames(stepIndices, episodeData);
      }
    } else {
      setClusterFrameImages([]);
    }
  }, [selectionData, allEpisodes, activeLearningState.episodeIndices, fetchClusterFrames]);

  // Generate proper target based on selection type
  const createTarget = (selectionType: string, data: any, step?: number) => {
    switch (selectionType) {
      case 'trajectory':
        const episode = allEpisodes[data];
        const episodeId = IDfromEpisode(episode);
        return {
          target_id: episodeId,
          reference: episode,
          origin: "online",
          timestamp: Date.now(),
        };
      case 'state':
        return {
          target_id: `state_${data[0]}_${data[1]}`,
          reference: null,
          origin: "online", 
          timestamp: Date.now(),
          step: step,
        };
      case 'cluster':
        return {
          target_id: `cluster_${data}`,
          reference: null,
          origin: "online",
          timestamp: Date.now(),
        };
      case 'coordinate':
        return {
          target_id: `coordinate_${data.x}_${data.y}`,
          reference: null,
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
    appDispatch({ type: 'SCHEDULE_FEEDBACK', payload: fb });
    
    try {
      await axios.post("/data/give_feedback", [fb]);
      console.log("Feedback submitted successfully:", fb);
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
    
    const category = getFeedbackCategory(fb.feedback_type, 
      fb.feedback_type === FeedbackType.Evaluative ? selectionData.type : undefined);
    
    activeLearningDispatch({ 
      type: 'UPDATE_FEEDBACK_COUNT', 
      payload: { category, isCurrentSession: true } 
    });
    
    setSubmitted(true);
    
    // Trigger onboarding step completion for feedback submission
    triggerStepComplete('provide-feedback');
    
    setTimeout(() => activeLearningDispatch({ type: 'SET_SELECTION', payload: [] }), 1500);
  };

  // Handle rating submission
  const handleRate = () => {
    const target = createTarget(selectionData.type, selectionData.data[0]);
    const fb: Feedback = {
      feedback_type: FeedbackType.Evaluative,
      targets: [target],
      granularity: selectionData.type === 'state' ? 'state' : 'episode',
      timestamp: Date.now(),
      session_id: appState.sessionId,
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
      session_id: appState.sessionId
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
      session_id: appState.sessionId,
      correction: correctionText
    };
    submitFeedback(fb);
  };

  const submitDemo = () => {
    const demoEpisode: Episode = {
      env_name: appState.selectedExperiment.env_id,
      benchmark_type: "generated",
      benchmark_id: -1,
      checkpoint_step: -1,
      episode_num: Date.now(),
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
      session_id: appState.sessionId,
    };
    
    submitFeedback(fb);
  };

  // Handle removing an episode from selection
  const removeFromSelection = useCallback((index: number) => {
    const newSelection = [...selection];
    newSelection.splice(index, 1);
    
    activeLearningDispatch({
      type: 'SET_SELECTION',
      payload: newSelection
    });
  }, [selection, activeLearningDispatch]);

  // Get color for an episode based on its index
  const getEpisodeColor = useCallback((episodeIdx: any) => {
    const color = getEpisodeColorFromUtil(episodeIdx, activeLearningState.trajectoryColors, false);
    if (color !== '#888888') {
      return color;
    }
    
    if (episodeIdx === -1) return '#888888';
    return d3.interpolateCool(episodeIdx / Math.max(1, allEpisodes.length - 1));
  }, [allEpisodes.length, activeLearningState.trajectoryColors]);

  // Handle video playback
  const handlePlayPause = useCallback((index: number) => {
    if (currentVideoIndex === index) {
      if (isPlaying) {
        videoRefs.current[index]?.pause();
        setIsPlaying(false);
      } else {
        videoRefs.current[index]?.play();
        setIsPlaying(true);
      }
    } else {
      if (currentVideoIndex !== null && videoRefs.current[currentVideoIndex]) {
        videoRefs.current[currentVideoIndex]?.pause();
      }
      setCurrentVideoIndex(index);
      videoRefs.current[index]?.play();
      setIsPlaying(true);
    }
  }, [currentVideoIndex, isPlaying]);

  // Create a reference for a video element
  const setVideoRef = useCallback((el: HTMLVideoElement | null, index: number) => {
    videoRefs.current[index] = el;
  }, []);

  // Get video element for an episode
  const getVideoElement = (episode: Episode, index: number, small = false, singleTrajectory = false) => {
    const episodeId = IDfromEpisode(episode);
    const videoUrl = videoURLs.get(episodeId);
    
    // For single trajectory on large screens, make video significantly larger
    const getMaxWidth = () => {
      if (singleTrajectory) {
        // Use viewport width to scale appropriately for large screens
        return 'min(600px, 60vw)';
      }
      return small ? '200px' : '300px';
    };
    
    return (
      <Box 
        sx={{ 
          position: 'relative',
          width: '100%',
          border: `3px solid ${getEpisodeColor(index)}`,
          borderRadius: 1,
          overflow: 'hidden',
          aspectRatio: '16/9',
          margin: '0 auto',
          maxWidth: getMaxWidth(),
        }}
      >
        {videoUrl ? (
          <>
            <video
              src={videoUrl}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
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
              size="small"
              sx={{ 
                position: 'absolute',
                bottom: 4,
                right: 4,
                backgroundColor: 'rgba(0,0,0,0.5)',
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.7)' },
                padding: '4px',
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
            py: 0.3,
            fontSize: '0.7rem',
          }}
        >
          Episode {episode.episode_num}
        </Box>
      </Box>
    );
  };

  // Render placeholder image for states
  const renderStatePlaceholder = useCallback(() => (
    <Box
      sx={{
        height: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.paper',
        border: '1px dashed',
        borderColor: 'primary.main',
        borderRadius: 1,
      }}
    >
      <ImageIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
    </Box>
  ), []);

  // Get title based on selection type
  const title = useMemo(() => {
    switch (selectionData.type) {
      case 'none':
        return 'No Selection';
      case 'trajectory':
        return 'Rate this trajectory';
      case 'multi_trajectory':
        return 'Select the best episode';
      case 'state':
        return 'Provide state correction';
      case 'cluster':
        return 'Rate this cluster of states';
      case 'coordinate':
        return 'Demo from coordinate';
      default:
        return 'Selection';
    }
  }, [selectionData]);

  // Main render function
  const renderContent = () => {
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
        const episode = allEpisodes[selectionData.data[0]];
        
        return (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%',
            overflow: 'hidden' 
          }}>
            <Typography variant="h6" gutterBottom>{title}</Typography>
            
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              flex: 1,
              alignItems: 'center',
              mb: 2,
              minHeight: 'min(450px, 50vh)' // Larger minimum height for single trajectory
            }}>
              {episode && (
                <Box sx={{ width: '100%' }}>
                  {getVideoElement(episode, selectionData.data[0], false, true)}
                </Box>
              )}
            </Box>
            
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center',
              mt: 'auto',
              mb: 1
            }}>
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
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
              <Button variant="contained" size="small" onClick={handleRate}>
                Submit Rating
              </Button>
            </Box>
          </Box>
        );

      case 'multi_trajectory':
        return (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%',
            overflow: 'hidden' 
          }}>
            <Typography variant="h6" gutterBottom>{title}</Typography>
            
            <Box sx={{ 
              flex: 1,
              overflowY: 'auto',
              pb: 1,
              minHeight: '300px'
            }}>
              <Grid container spacing={2}>
                {selectionData.data.map((trajectoryIdx, i) => {
                  if (typeof trajectoryIdx !== 'number') return null;
                  
                  const episode = allEpisodes[trajectoryIdx];
                  if (!episode) return null;
                  
                  const target = createTarget('trajectory', trajectoryIdx);
                  const id = target.target_id;
                  
                  return (
                    <Grid item xs={6} key={i}>
                      <Paper
                        elevation={chosenId === id ? 3 : 1}
                        sx={{
                          p: 1,
                          border: chosenId === id ? `2px solid ${getEpisodeColor(trajectoryIdx)}` : 'none',
                          transition: 'all 0.2s ease',
                          '&:hover': {
                            boxShadow: 2
                          },
                          height: 'fit-content',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        {/* Video display area - no selection interaction */}
                        <Box sx={{ mb: 1 }}>
                          {getVideoElement(episode, trajectoryIdx, true)}
                        </Box>
                        
                        {/* Selection area - separate from video */}
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            cursor: 'pointer',
                            p: 0.5,
                            borderRadius: 1,
                            '&:hover': {
                              backgroundColor: 'rgba(0, 0, 0, 0.04)'
                            }
                          }}
                          onClick={() => setChosenId(id)}
                        >
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
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 'auto', mb: 1 }}>
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
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%',
            overflow: 'auto' 
          }}>
            <Typography variant="h6" gutterBottom>{title}</Typography>
            
            {/* Placeholder for state visualization */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              mb: 2,
              flex: '0 0 auto'
            }}>
              <Box sx={{ 
                width: '100%', 
                maxWidth: '300px',
                backgroundColor: 'rgba(0,0,0,0.05)', 
                p: 2, 
                borderRadius: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  [State visualization placeholder]
                </Typography>
                <Box sx={{ 
                  width: '100%', 
                  height: '150px', 
                  backgroundColor: 'rgba(0,0,0,0.1)', 
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ImageIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                </Box>
              </Box>
            </Box>
            
            <Paper
              elevation={2}
              sx={{
                p: 1.5,
                mb: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                bgcolor: 'background.paper',
                flex: '1 1 auto'
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                State coordinates: [{stateData[0].toFixed(2)}, {stateData[1].toFixed(2)}]
              </Typography>
              
              <TextField
                fullWidth
                multiline
                rows={3}
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
        const clusterLabel = selectionData.label;
        const clusterIndices = selectionData.data;
        const maxStatesToShow = 12;
        const limitedIndices = clusterIndices.slice(0, maxStatesToShow);
        
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Cluster {clusterLabel} Selected ({clusterIndices.length} states)
            </Typography>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              {limitedIndices.map((i: number, index: number) => (
                <Grid item xs={6} sm={4} md={3} key={`cluster-state-${i}`}>
                  <Card>
                    <CardContent>
                      {clusterFrameImages[index] ? (
                        <Box
                          sx={{
                            height: 120,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'background.paper',
                            borderRadius: 1,
                            overflow: 'hidden',
                          }}
                        >
                          <img
                            src={clusterFrameImages[index]}
                            alt={`Cluster state ${i}`}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            height: 120,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'background.paper',
                            border: '1px dashed',
                            borderColor: 'primary.main',
                            borderRadius: 1,
                          }}
                        >
                          <ImageIcon sx={{ fontSize: 30, color: 'text.secondary' }} />
                        </Box>
                      )}
                      <Typography variant="caption" align="center" display="block">
                        State #{i}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {clusterIndices.length > maxStatesToShow && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    + {clusterIndices.length - maxStatesToShow} more states not shown
                  </Typography>
                </Grid>
              )}
            </Grid>
            
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
              Rating applies to all {clusterIndices.length} states in the cluster
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
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%',
            overflow: 'auto' 
          }}>
            <Typography variant="h6" gutterBottom fontSize="0.95rem">
              Demo from [{coordinate.x.toFixed(2)}, {coordinate.y.toFixed(2)}]
            </Typography>
            
            {/* Placeholder for coordinate visualization */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              mb: 2,
              flex: '0 0 auto'
            }}>
              <Box sx={{ 
                width: '100%', 
                maxWidth: '300px',
                backgroundColor: 'rgba(0,0,0,0.05)', 
                p: 2, 
                borderRadius: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  [Coordinate visualization placeholder]
                </Typography>
                <Box sx={{ 
                  width: '100%', 
                  height: '150px', 
                  backgroundColor: 'rgba(0,0,0,0.1)', 
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <ImageIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
                </Box>
              </Box>
            </Box>
            
            <Box sx={{ flex: '1 1 auto' }}>
              {!useWebRTC ? (
                <Button 
                  variant="contained" 
                  onClick={() => setUseWebRTC(true)}
                  disabled={loading}
                  size="small"
                  sx={{ mt: 1 }}
                >
                  Start Demo
                </Button>
              ) : (
                <WebRTCDemoComponent
                  sessionId={appState.sessionId}
                  experimentId={appState.selectedExperiment.id.toString()}
                  environmentId={appState.selectedExperiment.env_id}
                  coordinate={coordinate}
                  onSubmit={submitDemo}
                  onCancel={() => setUseWebRTC(false)}
                />
              )}
            </Box>
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
    <OnboardingHighlight stepId="provide-feedback" pulse={true} preserveLayout={true}>
      <Box 
        ref={containerRef}
        sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column',
          p: 1,
          overflow: 'hidden',
          position: 'relative'
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
        {renderContent()}
      </Box>
    </OnboardingHighlight>
  );
};

export default MergedSelectionFeedback;