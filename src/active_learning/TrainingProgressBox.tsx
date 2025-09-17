import React from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  LinearProgress, 
  Chip,
  Stack,
  IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useActiveLearningState } from '../ActiveLearningContext';

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
  const activeLearningState = useActiveLearningState();
  const [dismissed, setDismissed] = React.useState(false);

  // Reset dismissal when new training starts
  React.useEffect(() => {
    if (isTraining) setDismissed(false);
  }, [isTraining]);

  // Previous metrics from progress arrays
  const prevUncertainty = React.useMemo(() => {
    const arr = activeLearningState.progressUncertainties || [];
    return arr.length >= 2 ? arr[arr.length - 2] : null;
  }, [activeLearningState.progressUncertainties]);

  const prevReward = React.useMemo(() => {
    const arr = activeLearningState.progressRewards || [];
    return arr.length >= 2 ? arr[arr.length - 2] : null;
  }, [activeLearningState.progressRewards]);

  const fmt = (v: number | null) => (v === null || v === undefined) ? '-' : v.toFixed(4);
  const delta = (cur: number, prev: number | null) => (prev === null || prev === undefined) ? null : (cur - prev);
  const renderDelta = (d: number | null, mode: 'reward' | 'uncertainty') => {
    if (d === null) return null;
    const isGood = mode === 'reward' ? d > 0 : d < 0; // reward up good, uncertainty down good
    const color = isGood ? 'success.main' : d === 0 ? 'text.secondary' : 'error.main';
    const sign = d >= 0 ? '+' : '';
    return (
      <Box component="span" sx={{ color }}>
        {` (Δ ${sign}${d.toFixed(4)})`}
      </Box>
    );
  };
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

  if ((!isTraining && phaseStatus !== 'completed') || dismissed) {
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip 
              label={getStatusText(phaseStatus)} 
              color={getStatusColor(phaseStatus) as any}
              size="small"
            />
            <IconButton aria-label="Close" size="small" onClick={() => setDismissed(true)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {isTraining && (
          <LinearProgress 
            sx={{ 
              height: 6,
              borderRadius: 3,
            }}
          />
        )}

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
              <Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Uncertainty:</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {uncertainty.toFixed(4)}
                  </Typography>
                </Box>
                {prevUncertainty !== null && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Prev / Δ:</Typography>
                    <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                      {fmt(prevUncertainty)}
                      {renderDelta(delta(uncertainty, prevUncertainty), 'uncertainty')}
                    </Typography>
                  </Box>
                )}
              </Box>
              <Box>
                <Box display="flex" justifyContent="space-between">
                  <Typography variant="body2">Avg Reward:</Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {avgReward.toFixed(4)}
                  </Typography>
                </Box>
                {prevReward !== null && (
                  <Box display="flex" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Prev / Δ:</Typography>
                    <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                      {fmt(prevReward)}
                      {renderDelta(delta(avgReward, prevReward), 'reward')}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
};

export default TrainingProgressBox;
