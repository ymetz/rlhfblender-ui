import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Slider,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Paper,
  Divider,
  Alert
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Check, ThumbDown, ThumbUp } from '@mui/icons-material';
import chroma from 'chroma-js';
import { useAppState, useAppDispatch } from '../AppStateContext';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import { FeedbackType, Feedback, Episode } from '../types';
import * as d3 from 'd3';

// Helper to determine if an episode is a state
const isState = (episode: any): boolean => {
  return typeof episode.episode_num === 'string' && episode.episode_num.startsWith('state_');
};

// Helper to extract state number from episode
const getStateNumber = (episode: any): number => {
  if (!isState(episode)) return -1;
  return parseInt(episode.episode_num.split('_')[1], 10);
};

// Helper to check if states are consecutive
const areConsecutiveStates = (episodes: any[]): boolean => {
  if (!episodes.every(isState)) return false;
  
  const stateNumbers = episodes.map(getStateNumber).sort((a, b) => a - b);
  for (let i = 1; i < stateNumbers.length; i++) {
    if (stateNumbers[i] !== stateNumbers[i-1] + 1) return false;
  }
  return true;
};

const FeedbackInterface = () => {
  const theme = useTheme();
  const appState = useAppState();
  const appDispatch = useAppDispatch();
  const activeLearningState = useActiveLearningState();
  const activeLearningDispatch = useActiveLearningDispatch();
  
  // Local state
  const [evaluativeValue, setEvaluativeValue] = useState<number>(5);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [correctionText, setCorrectionText] = useState<string>('');
  const [submitted, setSubmitted] = useState<boolean>(false);
  
  // Get selected episodes
  const selectedEpisodes = activeLearningState.selection || [];
  const allEpisodes = appState.episodeIDsChronologically || [];
  
  // Reset state when selection changes
  useEffect(() => {
    setEvaluativeValue(5);
    setSelectedEpisodeId(null);
    setCorrectionText('');
    setSubmitted(false);
  }, [selectedEpisodes]);
  
  // Determine feedback type based on selection
  const getFeedbackType = (): string => {
    if (selectedEpisodes.length === 0) return 'none';
    if (selectedEpisodes.length === 1) {
      return isState(selectedEpisodes[0]) ? 'single_state' : 'single_episode';
    }
    if (selectedEpisodes.every(isState)) {
      return areConsecutiveStates(selectedEpisodes) ? 'consecutive_states' : 'multiple_states';
    }
    return 'multiple_episodes';
  };
  
  // Helper to get episode index in the full list
  const getEpisodeIndex = (episode: any) => {
    return allEpisodes.findIndex(ep => 
      ep.episode_num === episode.episode_num && 
      ep.env_name === episode.env_name && 
      ep.checkpoint_step === episode.checkpoint_step
    );
  };
  
  // Get color for an episode based on its index
  const getEpisodeColor = (episode: any) => {
    const episodeIdx = getEpisodeIndex(episode);
    if (episodeIdx === -1) return '#888888'; // Default color if not found
    return d3.interpolateCool(episodeIdx / Math.max(1, allEpisodes.length - 1));
  };
  
  // Create a unique ID for an episode
  const getEpisodeId = (episode: any): string => {
    return `${episode.env_name}_${episode.checkpoint_step}_${episode.episode_num}`;
  };
  
  // Helper to convert Episode object to format expected by the feedback system
  const episodeFromId = (episodeId: string): any => {
    // Find the episode in selected episodes that matches this ID
    const episodeParts = episodeId.split('_');
    const env_name = episodeParts[0];
    const checkpoint_step = parseInt(episodeParts[1], 10);
    const episode_num = episodeParts.slice(2).join('_'); // Handle state_X format
    
    return {
      env_name,
      checkpoint_step,
      episode_num,
      // Add other required fields
      benchmark_type: '',
      benchmark_id: 0
    };
  };
  
  // Handle evaluative feedback (slider) submission
  const handleEvaluativeSubmit = () => {
    if (selectedEpisodes.length === 0) return;
    
    const episodeId = getEpisodeId(selectedEpisodes[0]);
    
    const feedback: Feedback = {
      feedback_type: FeedbackType.Evaluative,
      targets: [{
        target_id: episodeId,
        reference: episodeFromId(episodeId),
        origin: "offline",
        timestamp: Date.now(),
      }],
      granularity: isState(selectedEpisodes[0]) ? "state" : "episode",
      timestamp: Date.now(),
      session_id: appState.sessionId,
      score: evaluativeValue,
    };
    
    // Schedule the feedback
    appDispatch({
      type: "SCHEDULE_FEEDBACK",
      payload: feedback
    });
    
    setSubmitted(true);
    
    // Clear selection after a delay
    setTimeout(() => {
      activeLearningDispatch({
        type: 'SET_SELECTION',
        payload: []
      });
    }, 1500);
  };
  
  // Handle comparative feedback (best-of-k) submission
  const handleComparativeSubmit = () => {
    if (!selectedEpisodeId || selectedEpisodes.length < 2) return;
    
    const episodeIds = selectedEpisodes.map(getEpisodeId);
    
    const feedback: Feedback = {
      feedback_type: FeedbackType.Comparative,
      targets: episodeIds.map(id => ({
        target_id: id,
        reference: episodeFromId(id),
        origin: "offline",
        timestamp: Date.now(),
      })),
      preferences: episodeIds.map(id => id === selectedEpisodeId ? 1 : 0),
      granularity: selectedEpisodes.every(isState) ? "state" : "episode",
      timestamp: Date.now(),
      session_id: appState.sessionId,
    };
    
    // Schedule the feedback
    appDispatch({
      type: "SCHEDULE_FEEDBACK",
      payload: feedback
    });
    
    setSubmitted(true);
    
    // Clear selection after a delay
    setTimeout(() => {
      activeLearningDispatch({
        type: 'SET_SELECTION',
        payload: []
      });
    }, 1500);
  };
  
  // Handle corrective feedback submission
  const handleCorrectiveSubmit = () => {
    if (selectedEpisodes.length === 0 || !correctionText.trim()) return;
    
    const episodeId = getEpisodeId(selectedEpisodes[0]);
    
    const feedback: Feedback = {
      feedback_type: FeedbackType.Corrective,
      targets: [{
        target_id: episodeId,
        reference: episodeFromId(episodeId),
        origin: "offline",
        timestamp: Date.now(),
      }],
      granularity: "state",
      timestamp: Date.now(),
      session_id: appState.sessionId,
      correction: correctionText,
    };
    
    // Schedule the feedback
    appDispatch({
      type: "SCHEDULE_FEEDBACK",
      payload: feedback
    });
    
    setSubmitted(true);
    
    // Clear selection after a delay
    setTimeout(() => {
      activeLearningDispatch({
        type: 'SET_SELECTION',
        payload: []
      });
    }, 1500);
  };
  
  // Render different feedback interfaces based on selection type
  const renderFeedbackInterface = () => {
    const feedbackType = getFeedbackType();
    
    if (feedbackType === 'none') {
      return (
        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper' }}>
          <Typography variant="body1" color="text.secondary">
            Select episodes to provide feedback.
          </Typography>
        </Paper>
      );
    }
    
    if (submitted) {
      return (
        <Alert severity="success" sx={{ my: 2 }}>
          Feedback submitted successfully! Clearing selection...
        </Alert>
      );
    }
    
    switch (feedbackType) {
      case 'single_episode':
        // Slider for rating a single episode
        return (
          <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Rate This Episode
            </Typography>
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              my: 2,
              px: 2
            }}>
              <ThumbDown 
                sx={{ 
                  color: theme.palette.text.secondary,
                  mr: 2,
                  '&:hover': { color: theme.palette.primary.main }
                }}
                onClick={() => setEvaluativeValue(Math.max(0, evaluativeValue - 1))}
              />
              
              <Slider
                step={1}
                min={0}
                max={10}
                value={evaluativeValue}
                valueLabelDisplay="auto"
                marks
                sx={{
                  color: chroma
                    .mix(
                      theme.palette.primary.main,
                      theme.palette.text.secondary,
                      1.0 - (evaluativeValue + 1) / 10,
                    )
                    .hex(),
                  mx: 2,
                  flex: 1
                }}
                onChange={(_, value) => setEvaluativeValue(value as number)}
              />
              
              <ThumbUp 
                sx={{ 
                  color: theme.palette.primary.main,
                  ml: 2 
                }}
                onClick={() => setEvaluativeValue(Math.min(10, evaluativeValue + 1))}
              />
            </Box>
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                onClick={handleEvaluativeSubmit}
              >
                Submit Rating
              </Button>
            </Box>
          </Box>
        );
        
      case 'multiple_episodes':
        // Best of K selection
        return (
          <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Select the Best Episode
            </Typography>
            
            <RadioGroup 
              value={selectedEpisodeId} 
              onChange={(e) => setSelectedEpisodeId(e.target.value)}
            >
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {selectedEpisodes.map((episode, index) => {
                  const episodeId = getEpisodeId(episode);
                  const episodeColor = getEpisodeColor(episode);
                  const isSelected = episodeId === selectedEpisodeId;
                  
                  return (
                    <Grid item xs={12} sm={6} md={4} key={index}>
                      <Card 
                        sx={{ 
                          border: isSelected 
                            ? `2px solid ${theme.palette.primary.main}` 
                            : `2px solid ${episodeColor}`,
                          position: 'relative',
                          transition: 'all 0.2s',
                          transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                          cursor: 'pointer'
                        }}
                        onClick={() => setSelectedEpisodeId(episodeId)}
                      >
                        {isSelected && (
                          <Box 
                            sx={{ 
                              position: 'absolute', 
                              top: 10, 
                              right: 10,
                              bgcolor: theme.palette.primary.main,
                              borderRadius: '50%',
                              p: 0.5,
                              zIndex: 1
                            }}
                          >
                            <Check sx={{ color: '#fff' }} />
                          </Box>
                        )}
                        <CardActionArea>
                          <CardContent>
                            <Typography variant="subtitle1">
                              Episode #{episode.episode_num}
                            </Typography>
                            <FormControlLabel 
                              value={episodeId} 
                              control={<Radio />} 
                              label="Select as best" 
                            />
                          </CardContent>
                        </CardActionArea>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </RadioGroup>
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                onClick={handleComparativeSubmit}
                disabled={!selectedEpisodeId}
              >
                Submit Selection
              </Button>
            </Box>
          </Box>
        );
        
      case 'single_state':
        // Corrective feedback for a single state
        return (
          <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Provide Corrective Feedback
            </Typography>
            
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Correction Description"
              value={correctionText}
              onChange={(e) => setCorrectionText(e.target.value)}
              placeholder="Describe what should be corrected in this state..."
              variant="outlined"
              sx={{ my: 2 }}
            />
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                onClick={handleCorrectiveSubmit}
                disabled={!correctionText.trim()}
              >
                Submit Correction
              </Button>
            </Box>
          </Box>
        );
        
      case 'consecutive_states':
      case 'multiple_states':
        // Slider for rating multiple states
        return (
          <Box sx={{ p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>
              Rate These States
            </Typography>
            
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              my: 2,
              px: 2
            }}>
              <ThumbDown 
                sx={{ 
                  color: theme.palette.text.secondary,
                  mr: 2,
                  '&:hover': { color: theme.palette.primary.main }
                }}
                onClick={() => setEvaluativeValue(Math.max(0, evaluativeValue - 1))}
              />
              
              <Slider
                step={1}
                min={0}
                max={10}
                value={evaluativeValue}
                valueLabelDisplay="auto"
                marks
                sx={{
                  color: chroma
                    .mix(
                      theme.palette.primary.main,
                      theme.palette.text.secondary,
                      1.0 - (evaluativeValue + 1) / 10,
                    )
                    .hex(),
                  mx: 2,
                  flex: 1
                }}
                onChange={(_, value) => setEvaluativeValue(value as number)}
              />
              
              <ThumbUp 
                sx={{ 
                  color: theme.palette.primary.main,
                  ml: 2 
                }}
                onClick={() => setEvaluativeValue(Math.min(10, evaluativeValue + 1))}
              />
            </Box>
            
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button 
                variant="contained" 
                onClick={handleEvaluativeSubmit}
              >
                Submit Rating
              </Button>
            </Box>
          </Box>
        );
        
      default:
        return null;
    }
  };
  
  return (
    <Box sx={{ mt: 4 }}>
      <Divider sx={{ mb: 3 }} />
      {renderFeedbackInterface()}
    </Box>
  );
};

export default FeedbackInterface;