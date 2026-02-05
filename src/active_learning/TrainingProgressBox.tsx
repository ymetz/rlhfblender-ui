import React from 'react';
import {
  Box,
  Paper,
  Typography,
  LinearProgress,
  Chip,
  Stack,
  Divider,
} from '@mui/material';
import { useActiveLearningState } from '../ActiveLearningContext';

interface TrainingProgressSummaryProps {
  isTraining: boolean;
  phaseStatus: string;
  message: string;
  uncertainty: number;
  avgReward: number;
  showTrainingIndicators?: boolean;
}

const TrainingProgressBox: React.FC<TrainingProgressSummaryProps> = ({
  isTraining,
  phaseStatus,
  message,
  uncertainty,
  avgReward,
  showTrainingIndicators = true,
}) => {
  const activeLearningState = useActiveLearningState();

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

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Stack spacing={2} sx={{ flex: 1 }}>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              Training Progress
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {message || 'Review the latest training results'}
            </Typography>
          </Box>
          <Chip
            label={getStatusText(phaseStatus)}
            color={getStatusColor(phaseStatus) as any}
            size="small"
            sx={{ minWidth: 120, justifyContent: 'center' }}
          />
        </Box>

        {isTraining && showTrainingIndicators && (
          <LinearProgress
            sx={{
              height: 6,
              borderRadius: 3,
            }}
          />
        )}

        <Divider sx={{ my: 1 }} />

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
