import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  LinearProgress, 
  Chip,
  Stack
} from '@mui/material';

interface TrainingProgressBoxProps {
  isTraining: boolean;
  trainingLoss: number;
  validationLoss: number;
  phaseStatus: string;
  message: string;
  uncertainty: number;
  avgReward: number;
}

const TrainingProgressBox: React.FC<TrainingProgressBoxProps> = ({
  isTraining,
  trainingLoss,
  validationLoss,
  phaseStatus,
  message,
  uncertainty,
  avgReward
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'training':
      case 'training_started':
        return 'warning';
      case 'error':
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Training Complete';
      case 'training':
        return 'Training in Progress';
      case 'training_started':
        return 'Training Started';
      case 'error':
      case 'failed':
        return 'Training Failed';
      default:
        return status;
    }
  };

  if (!isTraining && phaseStatus !== 'completed') {
    return null;
  }

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        top: 20,
        right: 20,
        width: 300,
        p: 2,
        zIndex: 1000,
        backgroundColor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
      }}
    >
      <Stack spacing={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Training Progress</Typography>
          <Chip 
            label={getStatusText(phaseStatus)} 
            color={getStatusColor(phaseStatus) as any}
            size="small"
          />
        </Box>

        {isTraining && (
          <LinearProgress 
            sx={{ 
              height: 6,
              borderRadius: 3,
            }}
          />
        )}

        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>

        {(trainingLoss > 0 || validationLoss > 0) && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Loss Metrics
            </Typography>
            <Stack spacing={1}>
              {trainingLoss > 0 && (
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Training Loss:</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {trainingLoss.toFixed(4)}
                  </Typography>
                </Box>
              )}
              {validationLoss > 0 && (
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Validation Loss:</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {validationLoss.toFixed(4)}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Box>
        )}

        {phaseStatus === 'completed' && (
          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Results
            </Typography>
            <Stack spacing={1}>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">Uncertainty:</Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {uncertainty.toFixed(4)}
                </Typography>
              </Box>
              <Box display="flex" justifyContent="space-between">
                <Typography variant="body2">Avg Reward:</Typography>
                <Typography variant="body2" fontFamily="monospace">
                  {avgReward.toFixed(4)}
                </Typography>
              </Box>
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default TrainingProgressBox;