import React from 'react';
import { Box, Paper, Typography, IconButton, List, ListItem, ListItemIcon, ListItemText, Chip, Divider } from '@mui/material';
import { ChevronLeft, TrendingDown, TrendingUp } from '@mui/icons-material';
import ProgressChart from './ProgressChart';
import FeedbackCounts from './FeedbackCounts';
import GridUncertaintyMap from './GridMap';
import FeedbackWaterfallChart from './FeedbackWaterfallChart';
import { useActiveLearningState, FeedbackHistoryEntry } from '../ActiveLearningContext';

interface TrainingProgressPanelProps {
  onClose: () => void;
}

const TrainingProgressPanel: React.FC<TrainingProgressPanelProps> = ({ onClose }) => {
  const activeLearningState = useActiveLearningState();
  
  // Calculate baseline uncertainty (could be from initial phase or last completed phase)
  const baselineUncertainty = activeLearningState.progressUncertainties.length > 0 
    ? activeLearningState.progressUncertainties[activeLearningState.progressUncertainties.length - 1]
    : 0.5; // Default baseline

  const feedbackData = activeLearningState.feedbackCounts;

  // Generate dummy feedback history data for testing
  const dummyFeedbackHistory: FeedbackHistoryEntry[] = [
    {
      id: 'feedback_1',
      type: 'Rating',
      target: { episode: 1, step: 5 },
      uncertaintyEffect: -0.08, // Decreased uncertainty
      timestamp: Date.now() - 4000,
      phase: 1
    },
    {
      id: 'feedback_2',
      type: 'Comparison',
      target: { episodes: [2, 3] },
      uncertaintyEffect: -0.12, // Good comparison reduced uncertainty
      timestamp: Date.now() - 3000,
      phase: 1
    },
    {
      id: 'feedback_3',
      type: 'Correction',
      target: { episode: 4, step: 8 },
      uncertaintyEffect: 0.03, // Slight increase (conflicting feedback)
      timestamp: Date.now() - 2000,
      phase: 1
    },
    {
      id: 'feedback_4',
      type: 'Demo',
      target: { trajectory: 'demo_1' },
      uncertaintyEffect: -0.15, // Demo significantly reduced uncertainty
      timestamp: Date.now() - 1000,
      phase: 1
    },
    {
      id: 'feedback_5',
      type: 'Cluster',
      target: { cluster_id: 'cluster_a' },
      uncertaintyEffect: -0.05, // Cluster feedback helped
      timestamp: Date.now(),
      phase: 1
    },
    {
      id: 'feedback_6',
      type: 'Rating',
      target: { episode: 5, step: 10 },
      uncertaintyEffect: -0.02, // Minor decrease
      timestamp: Date.now() - 5000,
      phase: 2
    },
    {
      id: 'feedback_7',
      type: 'Comparison',
      target: { episodes: [6, 7] },
      uncertaintyEffect: -0.1, // Good comparison reduced uncertainty
      timestamp: Date.now() - 4000,
      phase: 2
    },
    {
      id: 'feedback_8',
      type: 'Correction',
      target: { episode: 8, step: 12 },
      uncertaintyEffect: 0.05, // Slight increase (conflicting feedback)
      timestamp: Date.now() - 3000,
      phase: 2
    }
  ];

  // Use dummy data if no real feedback history exists
  const feedbackHistory = activeLearningState.feedbackHistory.length > 0 
    ? activeLearningState.feedbackHistory 
    : dummyFeedbackHistory;

  // Helper function to get feedback type color
  const getFeedbackTypeColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      'Rating': '#2196F3',
      'Comparison': '#4CAF50', 
      'Correction': '#FF9800',
      'Demo': '#9C27B0',
      'Cluster': '#F44336'
    };
    return colorMap[type] || '#666';
  };

  // Helper function to format timestamp
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Helper function to format target description
  const formatTargetDescription = (target: any) => {
    if (!target) return 'No target specified';
    
    if (target.episode !== undefined && target.step !== undefined) {
      return `Episode ${target.episode}, Step ${target.step}`;
    }
    
    if (target.episodes && Array.isArray(target.episodes)) {
      return `Episodes ${target.episodes.join(' vs ')}`;
    }
    
    if (target.trajectory) {
      return `Trajectory: ${target.trajectory}`;
    }
    
    if (target.cluster_id) {
      return `Cluster: ${target.cluster_id}`;
    }
    
    // Fallback for any other target format
    return JSON.stringify(target);
  };

  // Function to render feedback history grouped by phase
  const renderFeedbackHistoryByPhase = (history: FeedbackHistoryEntry[]) => {
    if (history.length === 0) {
      return (
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100%',
          color: 'text.secondary'
        }}>
          <Typography variant="body2">
            No feedback history available
          </Typography>
        </Box>
      );
    }

    // Group feedback by phase
    const feedbackByPhase = history.reduce((acc, feedback) => {
      const phase = feedback.phase;
      if (!acc[phase]) {
        acc[phase] = [];
      }
      acc[phase].push(feedback);
      return acc;
    }, {} as { [key: number]: FeedbackHistoryEntry[] });

    // Sort phases in descending order (latest first)
    const sortedPhases = Object.keys(feedbackByPhase)
      .map(Number)
      .sort((a, b) => b - a);

    return (
      <List dense sx={{ p: 0 }}>
        {sortedPhases.map((phase, phaseIndex) => (
          <React.Fragment key={phase}>
            {phaseIndex > 0 && <Divider sx={{ my: 1 }} />}
            
            {/* Phase Header */}
            <ListItem sx={{ px: 1, py: 0.5, backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                Phase {phase}
              </Typography>
            </ListItem>

            {/* Feedback entries for this phase */}
            {feedbackByPhase[phase]
              .sort((a, b) => b.timestamp - a.timestamp) // Sort by timestamp (latest first)
              .map((feedback) => (
                <ListItem key={feedback.id} sx={{ px: 1, py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: '32px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      {/* Feedback type color indicator */}
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: getFeedbackTypeColor(feedback.type),
                        }}
                      />
                      {/* Uncertainty effect direction indicator */}
                      {feedback.uncertaintyEffect < 0 ? (
                        <TrendingDown sx={{ fontSize: 14, color: 'rgba(76, 175, 80, 0.8)' }} />
                      ) : (
                        <TrendingUp sx={{ fontSize: 14, color: 'rgba(244, 67, 54, 0.8)' }} />
                      )}
                    </Box>
                  </ListItemIcon>
                  
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={feedback.type}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '10px',
                            backgroundColor: getFeedbackTypeColor(feedback.type),
                            color: 'white',
                            '& .MuiChip-label': { px: 1 }
                          }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                          {feedback.uncertaintyEffect > 0 ? '+' : ''}{feedback.uncertaintyEffect.toFixed(3)}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                        <Typography variant="caption" sx={{ fontSize: '9px', color: 'text.secondary' }}>
                          {formatTargetDescription(feedback.target)}
                        </Typography>
                        <Typography variant="caption" sx={{ fontSize: '10px', color: 'text.secondary' }}>
                          {formatTimestamp(feedback.timestamp)}
                        </Typography>
                      </Box>
                    }
                    sx={{ m: 0 }}
                  />
                </ListItem>
              ))}
          </React.Fragment>
        ))}
      </List>
    );
  };

  return (
    <>
      {/* Header with close button */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
          Training Progress & Feedback History
        </Typography>
        <IconButton onClick={onClose} size="small">
          <ChevronLeft />
        </IconButton>
      </Box>

      {/* Two-column layout */}
      <Box sx={{ display: 'flex', gap: 1, height: 'calc(100% - 60px)' }}>
        
        {/* Left Column - Original Training Progress Components */}
        <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', gap: 1 }}>
          
          {/* Progress Chart */}
          <Paper
            elevation={2}
            sx={{
              height: 'calc(33% - 0.33rem)',
              p: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                flex: 1,
                height: '90%',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <ProgressChart
                steps={activeLearningState.progressTrainingSteps}
                rewards={activeLearningState.progressRewards}
                uncertainties={activeLearningState.progressUncertainties}
                title="Training Progress"
              />
            </Box>
          </Paper>

          {/* Feedback Counts */}
          <Paper
            elevation={2}
            sx={{
              height: 'calc(33% - 0.33rem)',
              p: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                flex: 1,
                height: '90%',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <FeedbackCounts 
                data={feedbackData}
                title="Feedback History"
              />
            </Box>
          </Paper>

          {/* Grid Uncertainty Map */}
          <Paper
            elevation={2}
            sx={{
              height: 'calc(34% - 0.33rem)',
              p: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                flex: 1,
                height: '90%',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <GridUncertaintyMap
                gridPredictionImage={activeLearningState.grid_prediction_image}
                gridUncertaintyImage={activeLearningState.grid_uncertainty_image}
                datapointCoordinates={activeLearningState.projectionStates || []}
                gridCoordinates={undefined}
                gridUncertainties={undefined}
                imageOpacity={0.5}
                title="Decrease in Uncertainty"
              />
            </Box>
          </Paper>
        </Box>

        {/* Right Column - Feedback Waterfall Chart and History */}
        <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', gap: 1 }}>
          
          {/* Waterfall Chart */}
          <Paper
            elevation={2}
            sx={{
              height: '30%',
              p: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                flex: 1,
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <FeedbackWaterfallChart
                feedbackHistory={feedbackHistory}
                baselineUncertainty={baselineUncertainty}
                title="Feedback Impact on Uncertainty"
              />
            </Box>
            
            {/* Legend for feedback types */}
            <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #eee' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                Feedback Types:
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {[
                  { type: 'Rating', color: '#2196F3' },
                  { type: 'Comparison', color: '#4CAF50' },
                  { type: 'Correction', color: '#FF9800' },
                  { type: 'Demo', color: '#9C27B0' },
                  { type: 'Cluster', color: '#F44336' }
                ].map(({ type, color }) => (
                  <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box 
                      sx={{ 
                        width: 8, 
                        height: 8, 
                        backgroundColor: color, 
                        borderRadius: '2px' 
                      }} 
                    />
                    <Typography variant="caption" sx={{ fontSize: '10px' }}>
                      {type}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>

          {/* Feedback History List */}
          <Paper
            elevation={2}
            sx={{
              height: '68%',
              p: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
              Feedback History
            </Typography>
            
            <Box
              sx={{
                flex: 1,
                overflow: 'auto',
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: '#f1f1f1',
                  borderRadius: '3px',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: '#c1c1c1',
                  borderRadius: '3px',
                  '&:hover': {
                    backgroundColor: '#a8a8a8',
                  },
                },
              }}
            >
              {renderFeedbackHistoryByPhase(feedbackHistory)}
            </Box>
          </Paper>
        </Box>
      </Box>
    </>
  );
};

export default TrainingProgressPanel;