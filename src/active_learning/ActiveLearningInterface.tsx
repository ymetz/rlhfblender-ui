import React, { useEffect, useRef, useCallback } from 'react';
import { Box, Paper, Button, CircularProgress } from '@mui/material';
import axios from 'axios';
// Import components
import ProgressChart from './ProgressChart';
import ProjectionComponent from './ProjectionComponent';
import SelectionView from './SelectionView';
import FeedbackCounts from './FeedbackCounts';
import FeedbackInput from './FeedbackInput';
import TrainingProgressBox from './TrainingProgressBox';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import GridUncertaintyMap from './GridMap';
import { FeedbackType, Feedback } from '../types';
import { useAppState, useAppDispatch } from '../AppStateContext';


// define props for the active learning interface, stepSampler function
interface ActiveLearningInterfaceProps {
  stepSampler: () => void;
}

const ActiveLearningInterface: React.FC<ActiveLearningInterfaceProps> = ({ stepSampler }) => {

  const [waiting, setWaiting] = React.useState(false);
  const [isTraining, setIsTraining] = React.useState(false);
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
        axios.get(`/data/get_training_status?session_id=${appState.sessionId}&phase=${activeLearningState.currentPhase}`),
        axios.get(`/data/get_training_results?session_id=${appState.sessionId}&phase=${activeLearningState.currentPhase}`)
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

        // Find the next checkpoint
        const checkpoints = appState.selectedExperiment.checkpoint_list || [];
        const currentIndex = checkpoints.indexOf(appState.selectedCheckpoint.toString());
        
        if (currentIndex < checkpoints.length - 1) {
          // Move to the next checkpoint
          const nextCheckpoint = parseInt(checkpoints[currentIndex + 1]);
          appStateDispatch({ type: 'SET_SELECTED_CHECKPOINT', payload: nextCheckpoint });
        }
        
        // Use the existing stepSampler function to advance to the next batch
        await stepSampler();
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
      const response = await axios.post(`/data/train_iteration?session_id=${appState.sessionId}&experiment_id=${appState.selectedExperiment.id}&phase=${activeLearningState.currentPhase}`);
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

  // Use the feedback counts from the active learning state
  const feedbackData = activeLearningState.feedbackCounts;

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100%',
        height: '100%',
        minHeight: '600px',
      }}
    >
      {/* Left sidebar - 20% width with 3 charts stacked */}
      <Box
        sx={{
          width: '20%',
          display: 'flex',
          flexDirection: 'column',
          p: 1,
          gap: 1, // Use gap instead of margin-bottom for consistent spacing
          height: '100%', // Ensure the sidebar takes the full height
        }}
      >
        {/* First chart container - adjusted height */}
        <Paper
          elevation={2}
          sx={{
            height: 'calc(30% - 0.67rem)', // Adjusted for 3 components with 2 gaps
            p: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              flex: 1,
              height: '90%', // Leave room for the title
              position: 'relative',
              overflow: 'hidden' // Prevent overflow
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

                <Paper
          elevation={2}
          sx={{
            height: 'calc(30% - 0.67rem)', // Adjusted for 3 components with 2 gaps
            p: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              flex: 1,
              height: '90%', // Leave room for the title
              position: 'relative',
              overflow: 'hidden' // Prevent overflow
            }}
          >
            <FeedbackCounts 
              data={feedbackData}
              title="Feedback History"
            />
          </Box>
        </Paper>

        <Paper
          elevation={2}
          sx={{
            height: 'calc(35% - 0.67rem)', // Adjusted for 3 components with 2 gaps
            p: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              flex: 1,
              height: '90%', // Leave room for the title
              position: 'relative',
              overflow: 'hidden' // Prevent overflow
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

      {/* Middle section - 50% width with WebGL component */}
      <Box
        sx={{
          width: '50%',
          p: 1,
          height: '100%', // Ensure full height
        }}
      >
        <Paper
          elevation={2}
          sx={{
            height: 'calc(97% - 0.5rem)', // Adjusted for 3 components with 2 gaps
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

      {/* Right section - 30% width with 2 rows */}
      <Box
        sx={{
          width: '30%',
          display: 'flex',
          flexDirection: 'column',
          p: 1,
          gap: 1, // Use gap instead of margin for consistent spacing
          height: '100%', // Ensure full height
        }}
      >
        <Paper
          elevation={2}
          sx={{
            height: 'calc(50% - 0.5rem)', // Leave room for button at bottom
            p: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <SelectionView />
        </Paper>

        <Paper
          elevation={2}
          sx={{
            height: 'calc(35% - 0.5rem)', // Leave room for button at bottom
            p: 1,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <FeedbackInput />
        </Paper>

        {/* Button container with fixed height */}
        <Paper
          elevation={2}
          sx={{
            p: 1,
            height: 'calc(9% - 0.5rem)', // Fixed height for button area
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
            Go to Next Phase
          </Button>
        </Paper>
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