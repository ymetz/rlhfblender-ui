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
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  Image as ImageIcon,
  ThumbDown, 
  ThumbUp, 
  PlayArrow,
  Pause,
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
  const [coordinateFrameImage, setCoordinateFrameImage] = useState<string | null>(null);
  
  // Feedback state
  const [value, setValue] = useState(5);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [useWebRTC, setUseWebRTC] = useState(false);
  const [useWebRTCCorrection, setUseWebRTCCorrection] = useState(false);
  const [currentPlaying, setCurrentPlaying] = useState<number | null>(null);
  const [selectedStep, setSelectedStep] = useState(0);
  const [showCorrectionInterface, setShowCorrectionInterface] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Only force video re-render when selection changes, not when step changes
  // This prevents the flicker issue when scrubbing through timeline

  // Use selection directly from state
  const selection = useMemo(() => activeLearningState.selection || [], [activeLearningState.selection]);
  const allEpisodes = useMemo(() => appState.episodeIDsChronologically || [], [appState.episodeIDsChronologically]);

  // Extract selection type and data
  const selectionData = useMemo(() => {
    if (selection.length === 0) return { type: 'none', data: [] };
    if (selection.length === 1) {
      const item = selection[0];
      if (item.type === 'cluster')
        return { type: 'cluster', label: (item as any).label, data: item.data };
      if (item.type === 'coordinate')
        return { type: 'coordinate', data: [item.data] };
      // Treat both 'trajectory' and 'state' as 'state' selections
      // All single trajectory/state selections are actually state selections
      return { type: 'state', data: [item.data] };
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
    setUseWebRTC(false);
    setUseWebRTCCorrection(false);
    setCoordinateFrameImage(null);
    setSelectedStep(0); // Reset step navigation
    setShowCorrectionInterface(false); // Reset correction interface
  }, [selection]);

  // Extract state data for dependency tracking - now used to set initial selectedStep
  const currentStateData = selectionData.type === 'state' && selectionData.data?.[0] ? selectionData.data[0] : null;
  const currentStep = currentStateData?.step;
  
  // Calculate actual trajectory length from episode indices
  const getEpisodeLength = useCallback((episodeIdx: number) => {
    const episodeIndices = activeLearningState.episodeIndices || [];
    if (episodeIndices.length === 0) return 100; // fallback
    
    // Count how many states belong to this episode
    const statesInEpisode = episodeIndices.filter(idx => idx === episodeIdx).length;
    return Math.max(1, statesInEpisode);
  }, [activeLearningState.episodeIndices]);
  
  // Set initial step when state is selected or trajectory with state context
  useEffect(() => {
    if (selectionData.type === 'state' && currentStateData && currentStep !== null) {
      setSelectedStep(currentStep);
    } else if (selectionData.type === 'trajectory' && selection.length === 2) {
      // Check if we have both trajectory and state selections (from StateSequenceProjection)
      const stateSelection = selection.find(item => item.type === 'state');
      if (stateSelection && stateSelection.data?.step !== undefined) {
        setSelectedStep(stateSelection.data.step);
      } else {
        setSelectedStep(0);
      }
    } else {
      setSelectedStep(0);
    }
  }, [selectionData.type, currentStateData, currentStep, selection]);

  // Fetch coordinate frame when coordinate is selected
  useEffect(() => {
    if (selectionData.type === 'coordinate' && selectionData.data && selectionData.data.length > 0) {
      const coordinate = selectionData.data[0];
      
      const fetchCoordinateFrame = async () => {
        try {
          // Find the first episode to get environment info
          const firstEpisode = allEpisodes.find(episode => 
            episode.benchmark_id === appState.selectedExperiment.id
          );
          
          if (!firstEpisode) {
            console.error('No episode found for coordinate frame fetch');
            setCoordinateFrameImage(null);
            return;
          }
          
          const response = await fetch('/demo_generation/coordinate_to_render', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              coordinates: [coordinate.x, coordinate.y],
              env_id: firstEpisode.env_name,
              exp_id: appState.selectedExperiment.id
            }),
          });
          
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.render_frame) {
              // Set the base64 image as the frame
              setCoordinateFrameImage(`data:image/png;base64,${result.render_frame}`);
            } else {
              console.error('Failed to get render frame from response:', result);
              setCoordinateFrameImage(null);
            }
          } else {
            console.error(`Failed to fetch coordinate frame: ${response.status} ${response.statusText}`);
            setCoordinateFrameImage(null);
          }
        } catch (error) {
          console.error('Error fetching coordinate frame:', error);
          setCoordinateFrameImage(null);
        }
      };
      
      fetchCoordinateFrame();
    } else {
      setCoordinateFrameImage(null);
    }
  }, [selectionData, allEpisodes, appState.selectedExperiment.id]);

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
    if (selectionData.type === 'state' || selectionData.type === 'multi_trajectory') {
      const fetchVideos = async () => {
        setLoading(true);
        const newVideoURLMap = new Map<string, string>();
        
        if (selectionData.type === 'state') {
          // Handle state selection - extract episode index
          const stateData = selectionData.data[0];
          let episodeIdx: number;
          
          if (typeof stateData === 'number') {
            episodeIdx = stateData;
          } else {
            episodeIdx = stateData.episode;
          }
          
          if (allEpisodes[episodeIdx]) {
            const episode = allEpisodes[episodeIdx];
            const episodeID = IDfromEpisode(episode);
            try {
              const url = await getVideoURL(episodeID);
              newVideoURLMap.set(episodeID, url);
            } catch (error) {
              console.error("Error fetching video:", error);
            }
          }
        } else if (selectionData.type === 'multi_trajectory') {
          // Handle multiple trajectory selection
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
    // For evaluative feedback, always target the episode (not the specific state)
    const stateData = selectionData.data[0];
    let episodeIdx: number;
    
    if (typeof stateData === 'number') {
      episodeIdx = stateData;
    } else {
      episodeIdx = stateData.episode;
    }
    
    const episode = allEpisodes[episodeIdx];
    if (!episode) {
      console.error('Episode not found for rating:', episodeIdx);
      return;
    }
    
    const episodeID = IDfromEpisode(episode);
    
    const fb: Feedback = {
      feedback_type: FeedbackType.Evaluative,
      targets: [
        {
          target_id: episodeID,
          reference: episode,
          origin: "online",
          timestamp: Date.now(),
        }
      ],
      granularity: 'episode',
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


  // Get color for an episode based on its index
  const getEpisodeColor = useCallback((episodeIdx: any) => {
    const color = getEpisodeColorFromUtil(episodeIdx, activeLearningState.trajectoryColors, false);
    if (color !== '#888888') {
      return color;
    }
    
    if (episodeIdx === -1) return '#888888';
    return d3.interpolateCool(episodeIdx / Math.max(1, allEpisodes.length - 1));
  }, [allEpisodes.length, activeLearningState.trajectoryColors]);



  // Get video element for an episode
  const getVideoElement = (episode: Episode, index: number, small = false, singleTrajectory = false, stepSync = false, currentStepTime = 0, totalSteps?: number) => {
    const episodeId = IDfromEpisode(episode);
    const videoUrl = videoURLs.get(episodeId);
    const episodeLength = totalSteps || getEpisodeLength(index);
    
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
          boxShadow: currentPlaying === index ? '0 0 12px rgba(76, 175, 80, 0.5)' : 'none',
          transition: 'box-shadow 0.3s',
        }}
      >
        {videoUrl ? (
          <>
            <video
              src={videoUrl}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              muted
              autoPlay={currentPlaying === index && !stepSync}
              loop={currentPlaying === index && !stepSync}
              ref={el => {
                if (el) {
                  const syncVideoTime = () => {
                    if (stepSync) {
                      // Sync video time with selected step
                      const videoTotalSteps = episodeLength;
                      const duration = el.duration;
                      if (duration && !isNaN(duration) && duration > 0) {
                        const targetTime = (currentStepTime / videoTotalSteps) * duration;
                        if (!isNaN(targetTime) && Math.abs(targetTime - el.currentTime) > 0.1) {
                          el.currentTime = targetTime;
                          el.pause(); // Pause for step scrubbing
                        }
                      }
                    } else if (currentPlaying === index) {
                      el.play().catch(e => console.error("Video play error:", e));
                    } else {
                      el.pause();
                    }
                  };

                  // Wait for video metadata to load before syncing
                  if (el.readyState >= 1) {
                    syncVideoTime();
                  } else {
                    el.addEventListener('loadedmetadata', syncVideoTime, { once: true });
                  }
                  
                  // Store reference for play/pause control
                  videoRefs.current[index] = el;
                }
              }}
            />
            <IconButton 
              size="small"
              sx={{ 
                position: 'absolute',
                bottom: 4,
                right: 4,
                backgroundColor: currentPlaying === index ? 'rgba(76, 175, 80, 0.8)' : 'rgba(0,0,0,0.5)',
                color: 'white',
                '&:hover': { 
                  backgroundColor: currentPlaying === index ? 'rgba(76, 175, 80, 0.9)' : 'rgba(0,0,0,0.7)'
                },
                padding: '4px',
                transition: 'background-color 0.3s',
              }}
              onClick={() => {
                const videoEl = videoRefs.current[index];
                if (videoEl) {
                  if (currentPlaying === index) {
                    videoEl.pause();
                    setCurrentPlaying(null);
                  } else {
                    // Pause all other videos
                    videoRefs.current.forEach((video, i) => {
                      if (video && i !== index) {
                        video.pause();
                      }
                    });
                    videoEl.play().catch(e => console.error("Video play error:", e));
                    setCurrentPlaying(index);
                  }
                }
              }}
            >
              {currentPlaying === index ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
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

  // Get title based on selection type
  const title = useMemo(() => {
    switch (selectionData.type) {
      case 'none':
        return 'No Selection';
      case 'state':
        return 'Rate Episode';
      case 'multi_trajectory':
        return 'Select the Best Episode';
      case 'cluster':
        return 'Rate this Cluster of States';
      case 'coordinate':
        return 'Demo from New Coordinate';
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
        // All single selections are now state selections (trajectory + step)
        const stateData = selectionData.data[0];
        let episode: Episode;
        let episodeIdx: number;
        let episodeLength: number;
        
        // Handle both trajectory selections (just episode index) and state selections (with episode + step)
        if (typeof stateData === 'number') {
          // This is a trajectory selection from StateSequenceProjection
          episodeIdx = stateData;
          episode = allEpisodes[episodeIdx];
          episodeLength = getEpisodeLength(episodeIdx);
        } else {
          // This is a state selection with episode and step data
          episodeIdx = stateData.episode;
          episode = allEpisodes[episodeIdx];
          episodeLength = getEpisodeLength(episodeIdx);
        }
        
        if (!episode) {
          return (
            <Typography color="error">
              Episode {episodeIdx} not found
            </Typography>
          );
        }
        
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
              minHeight: 'min(350px, 40vh)'
            }}>
              <Box sx={{ width: '100%' }}>
                {getVideoElement(episode, episodeIdx, false, true, true, selectedStep, episodeLength)}
              </Box>
            </Box>
            
            {/* Timeline Navigation */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                mb: 1 
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="subtitle2">
                    Step Navigation
                  </Typography>
                  {currentPlaying === episodeIdx && (
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center',
                      backgroundColor: '#4CAF50',
                      color: 'white',
                      px: 1,
                      py: 0.25,
                      borderRadius: 1,
                      fontSize: '0.75rem',
                      fontFamily: 'inherit',
                      gap: 0.5
                    }}>
                      <PlayArrow sx={{ fontSize: '0.875rem' }} />
                      Playing
                    </Box>
                  )}
                </Box>
                <Button 
                  variant="outlined" 
                  size="small"
                  onClick={() => setShowCorrectionInterface(!showCorrectionInterface)}
                >
                  {showCorrectionInterface ? 'Show Rating' : 'Correct at Step'}
                </Button>
              </Box>
              
              {/* Step navigation controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Button 
                  size="small" 
                  variant="outlined"
                  onClick={() => setSelectedStep(Math.max(0, selectedStep - 1))}
                  disabled={selectedStep <= 0}
                >
                  ← Prev
                </Button>
                <Typography variant="body2" sx={{ mx: 1 }}>
                  Step: {selectedStep} / {episodeLength - 1}
                </Typography>
                <Button 
                  size="small" 
                  variant="outlined"
                  onClick={() => setSelectedStep(Math.min(episodeLength - 1, selectedStep + 1))}
                  disabled={selectedStep >= episodeLength - 1}
                >
                  Next →
                </Button>
              </Box>

              {/* Step slider */}
              <Box sx={{ px: 1 }}>
                <Slider
                  value={selectedStep}
                  min={0}
                  max={episodeLength - 1}
                  step={1}
                  size="small"
                  valueLabelDisplay="auto"
                  onChange={(_, v) => setSelectedStep(v as number)}
                  sx={{ width: '100%' }}
                />
              </Box>
            </Box>
            
            {/* Rating Interface or Correction Interface */}
            {showCorrectionInterface ? (
              !useWebRTCCorrection ? (
                <Box sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                  <Typography variant="subtitle2" sx={{ mb: 2 }}>
                    Correct behavior at Step {selectedStep}
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    <Button 
                      variant="contained" 
                      size="large"
                      onClick={() => setUseWebRTCCorrection(true)}
                      disabled={loading}
                    >
                      Start Correction Demo
                    </Button>
                  </Box>
                </Box>
              ) : (
                <WebRTCDemoComponent
                  sessionId={`${appState.sessionId}_correction`}
                  experimentId={appState.selectedExperiment.id.toString()}
                  environmentId={appState.selectedExperiment.env_id}
                  checkpoint={Number(appState.selectedCheckpoint)}
                  episodeNum={episode.episode_num}
                  step={selectedStep}
                  onSubmit={() => {
                    const fb: Feedback = {
                      feedback_type: FeedbackType.Corrective,
                      targets: [{
                        target_id: `state_${episode.episode_num}_${selectedStep}`,
                        reference: null,
                        origin: "online",
                        timestamp: Date.now(),
                        step: selectedStep
                      }],
                      granularity: 'state',
                      timestamp: Date.now(),
                      session_id: appState.sessionId,
                      correction: `Demo correction from episode ${episode.episode_num}, step ${selectedStep}`
                    };
                    
                    submitFeedback(fb);
                  }}
                  onCancel={() => {
                    setUseWebRTCCorrection(false);
                    setShowCorrectionInterface(false);
                  }}
                />
              )
            ) : (
              <>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center',
                  justifyContent: 'center',
                  mt: 'auto',
                  mb: 1
                }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center',
                    maxWidth: '400px',
                    width: '100%'
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
                      sx={{ mx: 1, flex: 1 }}
                    />
                    <ThumbUp 
                      sx={{ cursor: 'pointer', ml: 1 }} 
                      fontSize="small"
                      onClick={() => setValue(v => Math.min(10, v+1))} 
                    />
                    <Typography variant="body2" sx={{ ml: 1, minWidth: '30px', textAlign: 'center' }}>{value}/10</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                  <Button variant="contained" size="small" onClick={handleRate}>
                    Submit Rating
                  </Button>
                </Box>
              </>
            )}
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
            
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center',
                maxWidth: '400px',
                width: '100%'
              }}>
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
                  sx={{ mx: 2, flex: 1 }}
                />
                <ThumbUp 
                  sx={{ cursor: 'pointer', ml: 2 }} 
                  onClick={() => setValue(v => Math.min(10, v+1))} 
                />
                <Typography sx={{ ml: 2 }}>{value}/10</Typography>
              </Box>
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
              Generate Demo from New State
            </Typography>
            
            {/* Coordinate rendered frame visualization */}
            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center',
              mb: 2,
              flex: '0 0 auto'
            }}>
              <Box sx={{ 
                width: '100%', 
                maxWidth: 'min(400px, 60vw)', // Same sizing as state frame
                aspectRatio: '16/9',
                backgroundColor: 'rgba(0,0,0,0.05)', 
                borderRadius: 1,
                overflow: 'hidden',
                position: 'relative',
                border: '3px solid #FF6B35', // Orange border to distinguish from other frames
                margin: '0 auto'
              }}>
                {coordinateFrameImage ? (
                  <img
                    src={coordinateFrameImage}
                    alt={`Predicted state frame for coordinate [${coordinate.x.toFixed(2)}, ${coordinate.y.toFixed(2)}]`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%',
                    bgcolor: 'rgba(0,0,0,0.05)'
                  }}>
                    {loading ? <CircularProgress size={24} /> : <ImageIcon sx={{ fontSize: 60, color: 'text.secondary' }} />}
                  </Box>
                )}
                <Box 
                  sx={{ 
                    position: 'absolute', 
                    top: 4,
                    left: 4,
                    backgroundColor: '#FF6B35', // Orange to match border
                    color: 'white',
                    borderRadius: 1,
                    px: 1,
                    py: 0.3,
                    fontSize: '0.7rem',
                  }}
                >
                  Predicted State
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