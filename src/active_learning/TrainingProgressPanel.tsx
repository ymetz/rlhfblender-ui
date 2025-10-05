import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
} from '@mui/material';
import { Close, TrendingDown, TrendingUp } from '@mui/icons-material';
import ProgressChart from './ProgressChart';
import FeedbackCounts from './FeedbackCounts';
import GridUncertaintyMap from './GridMap';
import FeedbackWaterfallChart from './FeedbackWaterfallChart';
import TrainingProgressSummary from './TrainingProgressBox';
import { useActiveLearningState, FeedbackHistoryEntry } from '../ActiveLearningContext';

type TrainingSummaryProps = {
  isTraining: boolean;
  trainingLoss: number;
  validationLoss: number;
  phaseStatus: string;
  message: string;
  uncertainty: number;
  avgReward: number;
};

interface TrainingProgressPanelProps {
  onClose: () => void;
  trainingSummary: TrainingSummaryProps;
}

const DEFAULT_UNCERTAINTY_EFFECT: Record<string, number> = {
  Rating: -0.02,
  Comparison: -0.08,
  Correction: 0.04,
  Demo: -0.12,
  Cluster: -0.05,
};

const MIN_SYNTHETIC_UNCERTAINTY = 0;
const MAX_SYNTHETIC_UNCERTAINTY = 0.98;

const TrainingProgressPanel: React.FC<TrainingProgressPanelProps> = ({ onClose, trainingSummary }) => {
  const activeLearningState = useActiveLearningState();

  const baselineUncertainty = activeLearningState.progressUncertainties.length > 0
    ? activeLearningState.progressUncertainties[activeLearningState.progressUncertainties.length - 1]
    : 0.5;

  const feedbackData = activeLearningState.feedbackCounts;

  const feedbackHistory = useMemo(() => {
    const history = activeLearningState.feedbackHistory;
    if (!history || history.length === 0) return [] as FeedbackHistoryEntry[];

    let runningUncertainty = Math.max(baselineUncertainty, MIN_SYNTHETIC_UNCERTAINTY);
    return history.map((entry, index) => {
      const hasExplicitEffect =
        typeof entry.uncertaintyEffect === 'number' && !Number.isNaN(entry.uncertaintyEffect);

      const totalEntries = history.length;

      let effect = hasExplicitEffect
        ? entry.uncertaintyEffect
        : DEFAULT_UNCERTAINTY_EFFECT[entry.type] ?? -0.03;

      if (!hasExplicitEffect) {
        const baseMagnitude = Math.max(Math.abs(effect), 0.015);
        const remainingSlots = Math.max(1, totalEntries - index);
        const decay = Math.max(0.12, Math.pow(0.82, index));
        const scale = Math.min(1.5, baseMagnitude / 0.05);

        const remainingDown = Math.max(0, runningUncertainty - MIN_SYNTHETIC_UNCERTAINTY);
        const remainingUp = Math.max(0, MAX_SYNTHETIC_UNCERTAINTY - runningUncertainty);

        if (effect <= 0) {
          if (remainingSlots === 1) {
            effect = -remainingDown;
          } else if (remainingDown > 0) {
            const rate = Math.min(0.65, Math.max(0.1, 0.35 * scale * decay));
            const plannedDrop = remainingDown * rate;
            effect = -Math.min(remainingDown, plannedDrop);
          } else {
            effect = 0;
          }
        } else {
          if (remainingUp > 0) {
            const rate = Math.min(0.25, Math.max(0.05, 0.18 * scale * decay));
            const plannedIncrease = remainingUp * rate;
            effect = Math.min(remainingUp, plannedIncrease);
          } else {
            effect = 0;
          }
        }
      }

      const projected = runningUncertainty + effect;
      if (projected < MIN_SYNTHETIC_UNCERTAINTY) {
        effect = MIN_SYNTHETIC_UNCERTAINTY - runningUncertainty;
      } else if (projected > MAX_SYNTHETIC_UNCERTAINTY) {
        effect = MAX_SYNTHETIC_UNCERTAINTY - runningUncertainty;
      }

      runningUncertainty = Math.min(
        Math.max(runningUncertainty + effect, MIN_SYNTHETIC_UNCERTAINTY),
        MAX_SYNTHETIC_UNCERTAINTY,
      );

      return {
        ...entry,
        id: entry.id || `feedback_${index}`,
        uncertaintyEffect: effect,
      };
    });
  }, [activeLearningState.feedbackHistory, baselineUncertainty]);

  const getFeedbackTypeColor = (type: string) => {
    const colorMap: { [key: string]: string } = {
      Rating: '#2196F3',
      Comparison: '#4CAF50',
      Correction: '#FF9800',
      Demo: '#9C27B0',
      Cluster: '#F44336',
    };
    return colorMap[type] || '#666';
  };

  const formatTimestamp = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  const formatTargetDescription = (target: any) => {
    if (!target) return 'No target specified';

    if (typeof target === 'string') return target;

    if (target.description) return target.description;

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

    return JSON.stringify(target);
  };

  const renderFeedbackHistoryByPhase = (history: FeedbackHistoryEntry[]) => {
    if (history.length === 0) {
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'text.secondary',
          }}
        >
          <Typography variant="body2">No feedback history available</Typography>
        </Box>
      );
    }

    const feedbackByPhase = history.reduce((acc, feedback) => {
      const phase = feedback.phase;
      if (!acc[phase]) {
        acc[phase] = [];
      }
      acc[phase].push(feedback);
      return acc;
    }, {} as { [key: number]: FeedbackHistoryEntry[] });

    const sortedPhases = Object.keys(feedbackByPhase)
      .map(Number)
      .sort((a, b) => b - a);

    return (
      <List dense sx={{ p: 0 }}>
        {sortedPhases.map((phase, phaseIndex) => (
          <React.Fragment key={phase}>
            {phaseIndex > 0 && <Divider sx={{ my: 1 }} />}

            <ListItem sx={{ px: 1, py: 0.5, backgroundColor: 'rgba(0, 0, 0, 0.02)' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                Phase {phase}
              </Typography>
            </ListItem>

            {feedbackByPhase[phase]
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((feedback) => (
                <ListItem key={`${feedback.id}-${feedback.timestamp}`} sx={{ px: 1, py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: '32px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Box
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: getFeedbackTypeColor(feedback.type),
                        }}
                      />
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
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
                          {feedback.uncertaintyEffect > 0 ? '+' : ''}
                          {feedback.uncertaintyEffect.toFixed(3)}
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
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexShrink: 0 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Training Progress Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Review the impact of the latest training iteration across uncertainty and feedback.
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: {
            xs: '1fr',
            md: 'repeat(2, minmax(0, 1fr))',
            xl: 'repeat(3, minmax(0, 1fr))',
          },
          flex: 1,
          minHeight: 0,        // important
          gridAutoRows: 'minmax(0, 1fr)',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, height: '100%' }}>
          <Box sx={{ flex: 1, minHeight: 220 }}>
            <TrainingProgressSummary
              isTraining={trainingSummary.isTraining}
              trainingLoss={trainingSummary.trainingLoss}
              validationLoss={trainingSummary.validationLoss}
              phaseStatus={trainingSummary.phaseStatus}
              message={trainingSummary.message}
              uncertainty={trainingSummary.uncertainty}
              avgReward={trainingSummary.avgReward}
              showTrainingIndicators={false}
            />
          </Box>
          <Paper
            elevation={2}
            sx={{
              p: 1,
              flex: 1,
              minHeight: 240,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
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
              p: 1,
              flex: 1,
              minHeight: 220,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <FeedbackCounts data={feedbackData} title="Feedback Distribution" />
            </Box>
          </Paper>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, height: '100%' }}>
          <Paper
            elevation={2}
            sx={{
              p: 1,
              flex: 1,
              minHeight: 260,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <FeedbackWaterfallChart
                feedbackHistory={feedbackHistory}
                baselineUncertainty={baselineUncertainty}
                title="Feedback Impact on Uncertainty"
              />
            </Box>
            <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #eee' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', mb: 0.5 }}>
                Feedback Types
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {[
                  { type: 'Rating', color: '#2196F3' },
                  { type: 'Comparison', color: '#4CAF50' },
                  { type: 'Correction', color: '#FF9800' },
                  { type: 'Demo', color: '#9C27B0' },
                  { type: 'Cluster', color: '#F44336' },
                ].map(({ type, color }) => (
                  <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box
                      sx={{
                        width: 8,
                        height: 8,
                        backgroundColor: color,
                        borderRadius: '2px',
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
          <Paper
            elevation={2}
            sx={{
              p: 1,
              flex: 1,
              minHeight: 260,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <GridUncertaintyMap
                gridPredictionImage={activeLearningState.grid_prediction_image}
                gridUncertaintyImage={activeLearningState.grid_uncertainty_image}
                datapointCoordinates={activeLearningState.projectionStates || []}
                gridCoordinates={undefined}
                gridUncertainties={undefined}
                imageOpacity={0.5}
                title="Uncertainty Decrease Map"
              />
            </Box>
          </Paper>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 0, height: '100%' }}>
          <Paper
            elevation={2}
            sx={{
              p: 1,
              flex: 1,
              minHeight: 0,         // allow shrinking inside the grid cell
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',   // keep scroll on the inner box only
              minWidth: 0,
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, flexShrink: 0 }}>
              Feedback History
            </Typography>

            <Box
              sx={{
                flex: 1,
                minHeight: 0,        // THIS makes the child scrollable
                overflowY: 'auto',
                pr: 0.5,
                '&::-webkit-scrollbar': { width: '6px' },
                '&::-webkit-scrollbar-track': { backgroundColor: '#f1f1f1', borderRadius: '3px' },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: '#c1c1c1',
                  borderRadius: '3px',
                  '&:hover': { backgroundColor: '#a8a8a8' },
                },
              }}
            >
              {renderFeedbackHistoryByPhase(feedbackHistory)}
            </Box>
          </Paper>

        </Box>
      </Box>
    </Box>
  );
};

export default TrainingProgressPanel;
