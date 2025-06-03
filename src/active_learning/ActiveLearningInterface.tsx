import React, { useEffect } from 'react';
import { Box, Paper, Button, CircularProgress } from '@mui/material';
import axios from 'axios';
// Import components
import ProgressChart from './ProgressChart';
import ProjectionComponent from './ProjectionComponent';
import SelectionView from './SelectionView';
import FeedbackCounts from './FeedbackCounts';
import FeedbackInput from './FeedbackInput';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import GridUncertaintyMap from './GridMap';
import { FeedbackType } from '../types';
import { useAppState, useAppDispatch } from '../AppStateContext';


// define props for the active learning interface, stepSampler function
interface ActiveLearningInterfaceProps {
  stepSampler: () => void;
}

const ActiveLearningInterface: React.FC<ActiveLearningInterfaceProps> = ({ stepSampler }) => {

  const [waiting, setWaiting] = React.useState(false);
  const activeLearningState = useActiveLearningState();
  const appState = useAppState();
  const activeLearningDispatch = useActiveLearningDispatch();
  const appStateDispatch = useAppDispatch();

  // When we continue, the backend "trains the model" and then we can ask for the next batch of data

  // handle button press, tell server to train the model, set a loading state
  // when the model is trained, we can ask for the next batch of data

  /* sets:

    | { type: "SET_CURRENT_PHASE"; payload: number }
  | { type: "SET_PROGRESS_REWARDS"; payload: number[] }
  | { type: "SET_PROGRESS_UNCERTAINTIES"; payload: number[] }

  */

  const handleContinue = async () => {
    setWaiting(true);
    try {
      // First, train the current iteration
      const response = await axios.post('/data/train_iteration?session_id=' + appState.sessionId + '&experiment_id=' + appState.selectedExperiment.id);
      const data = response.data;

      // Update progress data
      const { phaseStatus, phaseTrainingStep, phaseReward, phaseUncertainty } = data;
      const updatedTrainingSteps = [...activeLearningState.progressTrainingSteps, phaseTrainingStep];
      const updatedProgressRewards = [...activeLearningState.progressRewards, phaseReward];
      const updatedProgressUncertainties = [...activeLearningState.progressUncertainties, phaseUncertainty];

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
      console.log("Current Phase:", checkpoints, currentIndex, appState.selectedCheckpoint);
      
      if (currentIndex < checkpoints.length - 1) {
        // Move to the next checkpoint
        const nextCheckpoint = checkpoints[currentIndex + 1];
        await appStateDispatch({ type: 'SET_SELECTED_CHECKPOINT', payload: nextCheckpoint });
      }
      
      // Use the existing stepSampler function to advance to the next batch
      // This will handle getting episodes and updating the UI
      await stepSampler();

    } catch (error) {
      console.error('Error during continue:', error);
    } finally {
      setWaiting(false);
    }
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