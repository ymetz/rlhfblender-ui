import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Box, Paper, Button, CircularProgress, IconButton, Drawer, Typography, Tooltip } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import axios from 'axios';
// Import components
import ProjectionComponent from './ProjectionComponent';
import MergedSelectionFeedback from './MergedSelectionFeedback';
import TrainingProgressBox from './TrainingProgressBox';
import TrainingProgressPanel from './TrainingProgressPanel';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import { FeedbackType, Feedback } from '../types';
import { useAppState, useAppDispatch } from '../AppStateContext';


// define props for the active learning interface, stepSampler function
interface ActiveLearningInterfaceProps {
  stepSampler: () => void;
}

const ActiveLearningInterface: React.FC<ActiveLearningInterfaceProps> = ({ stepSampler }) => {

  const [waiting, setWaiting] = React.useState(false);
  const [isTraining, setIsTraining] = React.useState(false);
  const [trainingProgressOpen, setTrainingProgressOpen] = useState(false);
  const [trainingStatus, setTrainingStatus] = React.useState({
    phaseStatus: '',
    message: '',
    trainingLoss: 0,
    validationLoss: 0,
    uncertainty: 0,
    avgReward: 0
  });
  
  const activeLearningState = useActiveLearningState();
  const appState = useAppState();
  const activeLearningDispatch = useActiveLearningDispatch();
  const appStateDispatch = useAppDispatch();
  
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to poll training status and results
  const pollTrainingProgress = useCallback(async () => {
    if (!appState.sessionId) return;

    try {
      const [statusResponse, resultsResponse] = await Promise.all([
        axios.get(`/dynamic_rlhf/get_training_status?session_id=${appState.sessionId}&phase=${activeLearningState.currentPhase}`),
        axios.get(`/dynamic_rlhf/get_training_results?session_id=${appState.sessionId}&phase=${activeLearningState.currentPhase}`)
      ]);

      const statusData = statusResponse.data;
      const resultsData = resultsResponse.data;
      
      console.log(resultsData);

      setTrainingStatus({
        phaseStatus: resultsData.phaseStatus || statusData.status,
        message: resultsData.message || statusData.message,
        trainingLoss: resultsData.training_loss || 0,
        validationLoss: resultsData.validation_loss || 0,
        uncertainty: resultsData.phaseUncertainty || 0,
        avgReward: resultsData.phaseReward || 0
      });

      // Check if training is complete
      if (resultsData.phaseStatus === 'completed' || statusData.status === 'completed') {
        setIsTraining(false);
        
        // Stop polling
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }

        // Update progress data with final results
        const { phaseUncertainty, phaseReward, phaseTrainingStep } = resultsData;
        const updatedTrainingSteps = [...activeLearningState.progressTrainingSteps, phaseTrainingStep || 0];
        const updatedProgressRewards = [...activeLearningState.progressRewards, phaseReward || 0];
        const updatedProgressUncertainties = [...activeLearningState.progressUncertainties, phaseUncertainty || 0];

        activeLearningDispatch({ type: 'SET_PROGRESS_TRAINING_STEPS', payload: updatedTrainingSteps });
        activeLearningDispatch({ type: 'SET_PROGRESS_REWARDS', payload: updatedProgressRewards });
        activeLearningDispatch({ type: 'SET_PROGRESS_UNCERTAINTIES', payload: updatedProgressUncertainties });

        // Update the current phase
        activeLearningDispatch({ 
          type: 'SET_CURRENT_PHASE', 
          payload: activeLearningState.currentPhase + 1 
        });

        // Set flag to indicate new data should be loaded
        activeLearningDispatch({
          type: 'SET_SHOULD_LOAD_NEW_DATA',
          payload: true
        });

        // Reset current session feedback counts
        const updatedFeedbackCounts = activeLearningState.feedbackCounts.map(item => ({
          ...item,
          total: item.total,
          current: 0
        }));
        
        activeLearningDispatch({ 
          type: 'SET_FEEDBACK_COUNTS', 
          payload: updatedFeedbackCounts 
        });

        // For DynamicRLHF, move to the next checkpoint (increment by 1)
        const nextCheckpoint = activeLearningState.currentPhase;
        
        // Add the new checkpoint to the experiment's checkpoint list and update UI
        const updatedExperiment = {
          ...appState.selectedExperiment,
          checkpoint_list: [...(appState.selectedExperiment.checkpoint_list || []), nextCheckpoint.toString()]
        };
        
        appStateDispatch({ type: 'SET_SELECTED_EXPERIMENT', payload: updatedExperiment });
        appStateDispatch({ type: 'SET_SELECTED_CHECKPOINT', payload: nextCheckpoint });
        
        // Check if we've reached the maximum number of iterations
        const maxIterations = 5; // This should ideally come from the session data
        if (activeLearningState.currentPhase >= maxIterations) {
          // Trigger experiment end modal
          appStateDispatch({ type: 'SET_END_MODAL_OPEN' });
        } else {
          // Only generate new data if we're continuing to the next phase
          // and there will be another training iteration
          console.log('Generating new data for next phase...');
          await stepSampler();
        }
        
        setWaiting(false);
      }

    } catch (error) {
      console.error('Error polling training progress:', error);
      
      // If there's an error, assume training failed
      setTrainingStatus(prev => ({
        ...prev,
        phaseStatus: 'error',
        message: 'Failed to get training status'
      }));
      setIsTraining(false);
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setWaiting(false);
    }
  }, [appState.sessionId, appState.selectedCheckpoint, appState.selectedExperiment.checkpoint_list, activeLearningState, activeLearningDispatch, appStateDispatch, stepSampler]);

  // Start polling function
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    setIsTraining(true);
    pollingIntervalRef.current = setInterval(pollTrainingProgress, 3000); // Poll every 3 seconds
  }, [pollTrainingProgress]);

  // Stop polling function
  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    setIsTraining(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const handleContinue = async () => {
    setWaiting(true);
    try {
      // First, submit any scheduled feedback that hasn't been submitted yet
      if (appState.scheduledFeedback.length > 0) {
        console.log("Submitting scheduled feedback:", appState.scheduledFeedback);
        try {
          // Create submit meta feedback
          const submitFeedback: Feedback = {
            session_id: appState.sessionId,
            feedback_type: FeedbackType.Meta,
            granularity: "entire",
            timestamp: Date.now(),
            meta_action: "submit",
            targets: [],
          };
          
          // Include submit feedback in the payload
          const feedbackToSubmit = [...appState.scheduledFeedback, submitFeedback];
          
          // Submit all feedback to server
          await axios.post("/data/give_feedback", feedbackToSubmit);
          
          // Clear scheduled feedback
          appStateDispatch({ type: "CLEAR_SCHEDULED_FEEDBACK" });
          
          console.log("All scheduled feedback submitted successfully");
        } catch (error) {
          console.error("Error submitting scheduled feedback:", error);
        }
      }

      // Then, train the current iteration
      const response = await axios.post(`/dynamic_rlhf/train_iteration?session_id=${appState.sessionId}&experiment_id=${appState.selectedExperiment.id}&phase=${activeLearningState.currentPhase}`);
      const data = response.data;

      // Check if training started successfully
      if (data.phaseStatus === 'training_started') {
        // Initialize training status
        setTrainingStatus({
          phaseStatus: data.phaseStatus,
          message: data.message,
          trainingLoss: 0,
          validationLoss: 0,
          uncertainty: data.phaseUncertainty || 0,
          avgReward: data.phaseReward || 0
        });

        // Start polling for progress updates
        startPolling();
        
        // Note: Progress updates and UI state changes will be handled by the polling function
        // when training completes
      } else {
        // If training didn't start properly, handle it like before
        console.warn('Training did not start properly:', data);
        setWaiting(false);
      }

    } catch (error) {
      console.error('Error during continue:', error);
      setWaiting(false);
      stopPolling();
    }
    // Note: setWaiting(false) is now handled by the polling function when training completes
};


  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height: '100%',
        minHeight: '600px',
        position: 'relative',
      }}
    >
      {/* Collapsible Training Progress Drawer */}
      <Drawer
        variant="temporary"
        anchor="left"
        open={trainingProgressOpen}
        onClose={() => setTrainingProgressOpen(false)}
        sx={{
          '& .MuiDrawer-paper': {
            width: '40vw',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            p: 1,
            gap: 1,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
          },
        }}
        ModalProps={{
          BackdropProps: {
            sx: {
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              backdropFilter: 'blur(4px)',
            },
          },
        }}
      >
        <TrainingProgressPanel onClose={() => setTrainingProgressOpen(false)} />
      </Drawer>

      {/* Training Progress Tab Button */}
      {!trainingProgressOpen && (
        <Tooltip title="Training Progress" placement="right">
          <IconButton
            onClick={() => setTrainingProgressOpen(true)}
            sx={{
              position: 'fixed',
              left: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1200,
              backgroundColor: 'primary.main',
              color: 'white',
              borderRadius: '0 8px 8px 0',
              '&:hover': {
                backgroundColor: 'primary.dark',
              },
              width: '40px',
              height: '160px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
            }}
          >
            <ChevronRight sx={{ fontSize: '16px' }} />
            <Typography 
              variant="caption" 
              sx={{ 
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                fontSize: '10px',
                lineHeight: 1,
              }}
            >
              TRAINING PROGRESS
            </Typography>
          </IconButton>
        </Tooltip>
      )}

      {/* Main content area */}
      <Box
        sx={{
          display: 'flex',
          width: '100%',
          height: '100%',
        }}
      >
        {/* Projection section - 2/3 width */}
        <Box
          sx={{
            width: '66.67%',
            p: 1,
            height: '100%',
          }}
        >
          <Paper
            elevation={2}
            sx={{
              height: 'calc(97% - 0.5rem)',
              p: 1.2,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <ProjectionComponent
                width="100%"
                height="100%"
              />
            </Box>
          </Paper>
        </Box>

        {/* Right section - 1/3 width */}
        <Box
          sx={{
            width: '33.33%',
            display: 'flex',
            flexDirection: 'column',
            p: 1,
            gap: 1,
            height: '100%',
          }}
        >
          {/* Merged Selection and Feedback */}
          <Paper
            elevation={2}
            sx={{
              height: 'calc(85% - 0.5rem)',
              p: 1,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <MergedSelectionFeedback />
          </Paper>

          {/* Button container with fixed height */}
          <Paper
            elevation={2}
            sx={{
              p: 1,
              height: 'calc(9% - 0.5rem)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Button
              variant="contained"
              color="primary"
              onClick={handleContinue}
            >
              {(() => {
                const checkpoints = appState.selectedExperiment.checkpoint_list || [];
                const currentIndex = checkpoints.indexOf(appState.selectedCheckpoint.toString());
                const isLastCheckpoint = currentIndex >= checkpoints.length - 1;
                return isLastCheckpoint ? 'Complete Experiment' : 'Go to Next Phase';
              })()}
            </Button>
          </Paper>
        </Box>
      </Box>
      
      {/* Training Progress Box */}
      <TrainingProgressBox
        isTraining={isTraining}
        trainingLoss={trainingStatus.trainingLoss}
        validationLoss={trainingStatus.validationLoss}
        phaseStatus={trainingStatus.phaseStatus}
        message={trainingStatus.message}
        uncertainty={trainingStatus.uncertainty}
        avgReward={trainingStatus.avgReward}
      />
      
      {waiting && (
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 1000,
          }}
        >
          <CircularProgress size={60} />
        </Box>
      )}
    </Box>
  );
};

export default ActiveLearningInterface;