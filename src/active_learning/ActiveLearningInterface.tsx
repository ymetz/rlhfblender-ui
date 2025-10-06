import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Box, Paper, Button, CircularProgress, IconButton, Typography, Tooltip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
import { ChevronRight, AirplaneTicket } from '@mui/icons-material';
import axios from 'axios';
// Import components
import ProjectionComponent from './ProjectionComponent';
import MergedSelectionFeedback from './MergedSelectionFeedback';
import TrainingProgressPanel from './TrainingProgressPanel';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import { FeedbackType, Feedback } from '../types';
import { useAppState, useAppDispatch } from '../AppStateContext';
import { OnboardingHighlight } from './OnboardingSystem';
import { useActiveLearningOnboarding } from './useActiveLearningOnboarding';


// define props for the active learning interface, stepSampler function
interface ActiveLearningInterfaceProps {
  stepSampler: () => void;
}

const ActiveLearningInterface: React.FC<ActiveLearningInterfaceProps> = ({ stepSampler }) => {

  const [waiting, setWaiting] = React.useState(false);
  const [isTraining, setIsTraining] = React.useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [pendingProgressSummary, setPendingProgressSummary] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
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
  const lastDataTimestampRef = useRef<number | null>(null);

  // Get onboarding hook (will only work when wrapped in OnboardingProvider)
  const { startOnboardingIfFirstTime, startActiveLearningTour, isOnboardingReady, triggerStepComplete } = useActiveLearningOnboarding();

  // Start onboarding when component mounts (only if first time)
  useEffect(() => {
    startOnboardingIfFirstTime();
  }, [startOnboardingIfFirstTime]);

  // Function to poll training status and results
  const pollTrainingProgress = useCallback(async (phase = activeLearningState.currentPhase) => {
    if (!appState.sessionId) return;

    try {
      const [statusResponse, resultsResponse] = await Promise.all([
        axios.get(`/dynamic_rlhf/get_training_status?session_id=${appState.sessionId}&phase=${phase}`),
        axios.get(`/dynamic_rlhf/get_training_results?session_id=${appState.sessionId}&phase=${phase}`)
      ]);

      const statusData = statusResponse.data;
      const resultsData = resultsResponse.data;

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

        // Phase was already updated before training started, no need to increment again

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

        setPendingProgressSummary(true);

        // Check if "simulation" exists and is true in resultsData - chose next checkpoint from existing checkpoint list,
        // do not add a new one
        if (resultsData.simulation) {
          const nextCheckpoint = appState.selectedExperiment.checkpoint_list?.[phase] || 0;
          appStateDispatch({ type: 'SET_SELECTED_CHECKPOINT', payload: Number(nextCheckpoint) });
        }
        else {
          // For DynamicRLHF, use the current phase as the checkpoint
          const nextCheckpoint = activeLearningState.currentPhase;

          // Add the new checkpoint to the experiment's checkpoint list and update UI
          const updatedExperiment = {
            ...appState.selectedExperiment,
            checkpoint_list: [...(appState.selectedExperiment.checkpoint_list || []), nextCheckpoint.toString()]
          };

          appStateDispatch({ type: 'SET_SELECTED_EXPERIMENT', payload: updatedExperiment });
          appStateDispatch({ type: 'SET_SELECTED_CHECKPOINT', payload: Number(nextCheckpoint) });
        }

        // Check if we've reached the maximum number of iterations
        const maxIterations = 5; // This should ideally come from the session data
        if (activeLearningState.currentPhase >= maxIterations) {
          // Trigger experiment end modal
          appStateDispatch({ type: 'SET_END_MODAL_OPEN' });
        } else {
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
      setPendingProgressSummary(false);

      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      setWaiting(false);
    }
  }, [appState.sessionId, appState.selectedExperiment, activeLearningState.currentPhase, activeLearningState.progressTrainingSteps, activeLearningState.progressRewards, activeLearningState.progressUncertainties, activeLearningState.feedbackCounts, activeLearningDispatch, appStateDispatch, stepSampler]);

  // Start polling function
  const startPolling = useCallback((phase: number) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    setIsTraining(true);
    setProgressModalOpen(false);
    setPendingProgressSummary(false);
    pollingIntervalRef.current = setInterval(() => {
      pollTrainingProgress(phase);
    }, 3000); // Poll every 3 seconds
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

  useEffect(() => {
    const timestamp = activeLearningState.lastDataUpdateTimestamp ?? 0;
    const previous = lastDataTimestampRef.current ?? 0;

    if (timestamp > 0 && timestamp !== previous) {
      if (pendingProgressSummary) {
        setProgressModalOpen(true);
        setPendingProgressSummary(false);
      }
      lastDataTimestampRef.current = timestamp;
    }
  }, [activeLearningState.lastDataUpdateTimestamp, pendingProgressSummary]);

  const handleContinueConfirmed = async () => {
    setWaiting(true);

    // Trigger onboarding step completion for next-phase
    triggerStepComplete('next-phase');

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

        } catch (error) {
          console.error("Error submitting scheduled feedback:", error);
        }
      }

      // Submit the session to integrate feedback before training
      try {
        await axios.post(`/data/submit_session?session_id=${appState.sessionId}&saveDynamicRLHFFormat=true`);
        console.log("Session feedback submitted successfully");
      } catch (error) {
        console.error("Error submitting session:", error);
      }

      // Determine the correct phase to call
      // Phase 0 = initial data collection (called from dynamic-rlhf-modal)
      // Phase 1+ = training iterations with feedback
      const phaseToCall = activeLearningState.currentPhase === 0 ? 1 : activeLearningState.currentPhase + 1;

      // Update the current phase before training
      activeLearningDispatch({
        type: 'SET_CURRENT_PHASE',
        payload: phaseToCall
      });

      // Then, train the current iteration
      const response = await axios.post(`/dynamic_rlhf/train_iteration?session_id=${appState.sessionId}&experiment_id=${appState.selectedExperiment.id}&phase=${phaseToCall}`);
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
        startPolling(phaseToCall);

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

  const handleProgressModalOpen = useCallback(() => {
    setProgressModalOpen(true);
    setPendingProgressSummary(false);
  }, []);

  const handleProgressModalClose = useCallback(() => {
    setProgressModalOpen(false);
  }, []);

  const handleNextPhaseClick = useCallback(() => {
    setConfirmDialogOpen(true);
  }, []);

  const handleConfirmDialogClose = useCallback(() => {
    setConfirmDialogOpen(false);
  }, []);

  const handleConfirmDialogProceed = () => {
    setConfirmDialogOpen(false);
    void handleContinueConfirmed();
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
      <Tooltip title="Training Dashboard" placement="right">
        <IconButton
          onClick={handleProgressModalOpen}
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
            TRAINING DASHBOARD
          </Typography>
        </IconButton>
      </Tooltip>

      {/* Onboarding Help Button - Only show when conditions are met */}
      {isOnboardingReady() && (
        <Tooltip title="Start Onboarding Tour" placement="left">
          <IconButton
            onClick={startActiveLearningTour}
            sx={{
              position: 'fixed',
              right: 16,
              bottom: 16,
              zIndex: 1200,
              backgroundColor: 'rgba(25, 118, 210, 0.1)',
              color: 'primary.main',
              border: '2px solid',
              borderColor: 'primary.main',
              '&:hover': {
                backgroundColor: 'primary.main',
                color: 'white',
              },
              width: '48px',
              height: '48px',
            }}
          >
            <AirplaneTicket />
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
            <OnboardingHighlight stepId="next-phase" pulse={true}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleNextPhaseClick}
              >
                {(() => {
                  const checkpoints = appState.selectedExperiment.checkpoint_list || [];
                  const currentIndex = checkpoints.indexOf(appState.selectedCheckpoint.toString());
                  const isLastCheckpoint = currentIndex >= checkpoints.length - 1;
                  return isLastCheckpoint ? 'Complete Experiment' : 'Go to Next Phase';
                })()}
              </Button>
            </OnboardingHighlight>
          </Paper>
        </Box>
      </Box>
      <Dialog
        open={confirmDialogOpen}
        onClose={handleConfirmDialogClose}
        aria-labelledby="next-phase-confirmation-title"
      >
        <DialogTitle id="next-phase-confirmation-title">Confirm Next Phase</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to go to the next phase?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleConfirmDialogClose} variant="outlined">
            Cancel
          </Button>
          <Button onClick={handleConfirmDialogProceed} variant="contained" color="primary">
            Continue
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={progressModalOpen}
        onClose={handleProgressModalClose}
        fullWidth
        maxWidth="xl"
        PaperProps={{
          sx: {
            // give the dialog a fixed, bounded height
            height: '85vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          },
        }}
      >
        <DialogContent
          sx={{
            p: 3,
            // let content fill the paper and allow inner scrolling
            flex: 1,
            minHeight: 0,
            display: 'flex',
            overflow: 'hidden',
          }}
        >
          <TrainingProgressPanel
            onClose={handleProgressModalClose}
            trainingSummary={{
              isTraining,
              trainingLoss: trainingStatus.trainingLoss,
              validationLoss: trainingStatus.validationLoss,
              phaseStatus: trainingStatus.phaseStatus,
              message: trainingStatus.message,
              uncertainty: trainingStatus.uncertainty,
              avgReward: trainingStatus.avgReward,
            }}
          />
        </DialogContent>
      </Dialog>
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
