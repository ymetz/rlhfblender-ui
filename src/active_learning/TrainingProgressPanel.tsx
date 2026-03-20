import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
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
import GridUncertaintyMap from './GridMap';
import FeedbackWaterfallChart from './FeedbackWaterfallChart';
import { useActiveLearningState, FeedbackHistoryEntry } from '../ActiveLearningContext';
import { useAppState } from '../AppStateContext';

type TrainingSummaryProps = {
  isTraining: boolean;
  phaseStatus: string;
  message: string;
  uncertainty: number;
  avgReward: number;
};

interface TrainingProgressPanelProps {
  onClose: () => void;
  trainingSummary: TrainingSummaryProps;
}

type TrajectoryEpisode = {
  episode: number;
  points: number[][];
};

type TrajectoryBundle = {
  episodes: TrajectoryEpisode[];
  episode_count: number;
  point_count: number;
} | null;

type DifferenceStatsPayload = {
  grid: {
    min: number;
    max: number;
    mean: number;
    median: number;
    std: number;
    fraction_decrease: number;
  };
  current_mean_uncertainty: number;
  previous_mean_uncertainty: number;
};

type UncertaintyDifferencePayload = {
  current_checkpoint: number;
  previous_checkpoint: number;
  difference_image: string | null;
  projection_bounds?: {
    x_min: number;
    x_max: number;
    y_min: number;
    y_max: number;
  };
  difference_range?: {
    min: number;
    max: number;
  };
  difference_stats: DifferenceStatsPayload;
  grid: {
    coordinates: number[][];
    difference: number[];
    current_uncertainty: number[];
    previous_uncertainty: number[];
  };
  trajectories: {
    current: TrajectoryBundle;
    previous: TrajectoryBundle;
  };
};

const trimTrajectoryEpisode = (trajectory: TrajectoryEpisode | null): TrajectoryEpisode | null => {
  if (!trajectory) return null;
  const points = Array.isArray(trajectory.points) ? trajectory.points : [];
  const trimmedPoints = points.length > 1 ? points.slice(0, -1) : points;
  return trimmedPoints.length > 0 ? { ...trajectory, points: trimmedPoints } : null;
};

const buildTrajectoriesFromProjections = (
  points: number[][],
  episodeIndices: number[],
): TrajectoryEpisode[] => {
  if (!points || !episodeIndices || points.length === 0 || episodeIndices.length === 0) {
    return [];
  }

  const limit = Math.min(points.length, episodeIndices.length);
  const episodeMap = new Map<number, number[][]>();

  for (let i = 0; i < limit; i += 1) {
    const point = points[i];
    const episode = episodeIndices[i];
    if (!Array.isArray(point) || point.length < 2) continue;
    if (typeof episode !== 'number' || Number.isNaN(episode)) continue;
    const list = episodeMap.get(episode) || [];
    list.push([Number(point[0]), Number(point[1])]);
    episodeMap.set(episode, list);
  }

  return Array.from(episodeMap.entries())
    .map(([episode, pts]) => trimTrajectoryEpisode({ episode, points: pts }))
    .filter((item): item is TrajectoryEpisode => item !== null)
    .sort((a, b) => a.episode - b.episode);
};

const DEFAULT_UNCERTAINTY_EFFECT: Record<string, number> = {
  Rating: -0.02,
  Comparison: -0.08,
  Correction: 0.04,
  Demo: -0.12,
  Cluster: -0.05,
};

const MIN_SYNTHETIC_UNCERTAINTY = 0;
const MAX_SYNTHETIC_UNCERTAINTY = 0.98;

const FEEDBACK_TYPE_COLORS: Record<string, string> = {
  Rating: '#2196F3',
  Comparison: '#4CAF50',
  Correction: '#FF9800',
  Demo: '#9C27B0',
  Cluster: '#F44336',
};

const TrainingProgressPanel: React.FC<TrainingProgressPanelProps> = ({ onClose }) => {
  const activeLearningState = useActiveLearningState();
  const appState = useAppState();

  const [uncertaintyDifference, setUncertaintyDifference] = useState<UncertaintyDifferencePayload | null>(null);
  const [isDifferenceLoading, setIsDifferenceLoading] = useState(false);
  const [differenceError, setDifferenceError] = useState<string | null>(null);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);

  // Refs for scrolling list to selected item
  const listItemRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  const benchmarkId = appState.selectedExperiment?.id ?? null;

  const checkpointInfo = useMemo(() => {
    const rawList = appState.selectedExperiment?.checkpoint_list ?? [];
    const numericCheckpoints = rawList
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value));

    if (numericCheckpoints.length === 0) {
      return { current: null as number | null, previous: null as number | null };
    }

    const uniqueSorted = Array.from(new Set(numericCheckpoints)).sort((a, b) => a - b);
    const selected = Number(appState.selectedCheckpoint);

    if (Number.isFinite(selected) && uniqueSorted.includes(selected)) {
      const selectedIndex = uniqueSorted.indexOf(selected);
      return {
        current: selected,
        previous: selectedIndex > 0 ? uniqueSorted[selectedIndex - 1] : null,
      };
    }

    const last = uniqueSorted[uniqueSorted.length - 1];
    const prev = uniqueSorted.length > 1 ? uniqueSorted[uniqueSorted.length - 2] : null;
    return { current: last, previous: prev };
  }, [appState.selectedCheckpoint, appState.selectedExperiment?.checkpoint_list]);

  const currentCheckpoint = checkpointInfo.current;
  const previousCheckpoint = checkpointInfo.previous;

  useEffect(() => {
    if (!benchmarkId || currentCheckpoint === null) {
      setUncertaintyDifference(null);
      setDifferenceError(null);
      setIsDifferenceLoading(false);
      return;
    }

    if (previousCheckpoint === null) {
      setUncertaintyDifference(null);
      setDifferenceError('At least two checkpoints are required to visualise uncertainty changes.');
      setIsDifferenceLoading(false);
      return;
    }

    let isCancelled = false;
    setIsDifferenceLoading(true);
    setDifferenceError(null);

    axios
      .post<UncertaintyDifferencePayload>('/projection/load_uncertainty_difference', {
        benchmark_id: benchmarkId,
        current_checkpoint_step: currentCheckpoint,
        previous_checkpoint_step: previousCheckpoint,
        projection_method: activeLearningState.embeddingMethod || 'PCA',
      })
      .then((response) => { if (!isCancelled) setUncertaintyDifference(response.data); })
      .catch((error) => {
        if (isCancelled) return;
        const detail = error?.response?.data?.detail;
        setDifferenceError(typeof detail === 'string' ? detail : 'Failed to load uncertainty difference data.');
        setUncertaintyDifference(null);
      })
      .finally(() => { if (!isCancelled) setIsDifferenceLoading(false); });

    return () => { isCancelled = true; };
  }, [benchmarkId, currentCheckpoint, previousCheckpoint, activeLearningState.embeddingMethod]);

  // Scroll list to selected item when selection comes from the chart
  useEffect(() => {
    if (selectedFeedbackId) {
      const el = listItemRefs.current.get(selectedFeedbackId);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedFeedbackId]);

  const previousTrajectories = useMemo<TrajectoryEpisode[]>(() => {
    if (uncertaintyDifference?.trajectories?.previous?.episodes?.length) {
      return uncertaintyDifference.trajectories.previous.episodes
        .map((t) => trimTrajectoryEpisode(t))
        .filter((item): item is TrajectoryEpisode => item !== null);
    }
    return [];
  }, [uncertaintyDifference]);

  const currentTrajectories = useMemo<TrajectoryEpisode[]>(() => {
    if (uncertaintyDifference?.trajectories?.current?.episodes?.length) {
      return uncertaintyDifference.trajectories.current.episodes
        .map((t) => trimTrajectoryEpisode(t))
        .filter((item): item is TrajectoryEpisode => item !== null);
    }
    return buildTrajectoriesFromProjections(
      activeLearningState.projectionStates || [],
      activeLearningState.episodeIndices || [],
    );
  }, [uncertaintyDifference, activeLearningState.projectionStates, activeLearningState.episodeIndices]);

  const gridDifferenceData = uncertaintyDifference?.grid;
  const differenceRange = uncertaintyDifference?.difference_range;
  const differenceStats = uncertaintyDifference?.difference_stats;

  const baselineUncertainty = activeLearningState.progressUncertainties.length > 0
    ? activeLearningState.progressUncertainties[activeLearningState.progressUncertainties.length - 1]
    : 0.5;

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
            effect = -Math.min(remainingDown, remainingDown * rate);
          } else {
            effect = 0;
          }
        } else {
          if (remainingUp > 0) {
            const rate = Math.min(0.25, Math.max(0.05, 0.18 * scale * decay));
            effect = Math.min(remainingUp, remainingUp * rate);
          } else {
            effect = 0;
          }
        }
      }

      const projected = runningUncertainty + effect;
      if (projected < MIN_SYNTHETIC_UNCERTAINTY) effect = MIN_SYNTHETIC_UNCERTAINTY - runningUncertainty;
      else if (projected > MAX_SYNTHETIC_UNCERTAINTY) effect = MAX_SYNTHETIC_UNCERTAINTY - runningUncertainty;

      runningUncertainty = Math.min(
        Math.max(runningUncertainty + effect, MIN_SYNTHETIC_UNCERTAINTY),
        MAX_SYNTHETIC_UNCERTAINTY,
      );

      return { ...entry, id: entry.id || `feedback_${index}`, uncertaintyEffect: effect };
    });
  }, [activeLearningState.feedbackHistory, baselineUncertainty]);

  const formatTimestamp = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const formatTargetDescription = (target: any) => {
    if (!target) return 'No target specified';
    if (typeof target === 'string') return target;
    if (target.description) return target.description;
    if (target.episode !== undefined && target.step !== undefined) return `Episode ${target.episode}, Step ${target.step}`;
    if (target.episodes && Array.isArray(target.episodes)) return `Episodes ${target.episodes.join(' vs ')}`;
    if (target.trajectory) return `Trajectory: ${target.trajectory}`;
    if (target.cluster_id) return `Cluster: ${target.cluster_id}`;
    return JSON.stringify(target);
  };

  const renderFeedbackHistory = (history: FeedbackHistoryEntry[]) => {
    if (history.length === 0) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
          <Typography variant="body2">No feedback history available</Typography>
        </Box>
      );
    }

    const feedbackByPhase = history.reduce((acc, feedback) => {
      if (!acc[feedback.phase]) acc[feedback.phase] = [];
      acc[feedback.phase].push(feedback);
      return acc;
    }, {} as Record<number, FeedbackHistoryEntry[]>);

    const sortedPhases = Object.keys(feedbackByPhase).map(Number).sort((a, b) => b - a);

    return (
      <List dense sx={{ p: 0 }}>
        {sortedPhases.map((phase, phaseIndex) => (
          <React.Fragment key={phase}>
            {phaseIndex > 0 && <Divider sx={{ my: 1 }} />}
            <ListItem sx={{ px: 1, py: 0.5, backgroundColor: 'rgba(0,0,0,0.02)' }}>
              <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                Phase {phase}
              </Typography>
            </ListItem>
            {feedbackByPhase[phase]
              .sort((a, b) => b.timestamp - a.timestamp)
              .map((feedback) => {
                const isSelected = feedback.id === selectedFeedbackId;
                return (
                  <ListItem
                    key={`${feedback.id}-${feedback.timestamp}`}
                    ref={(el) => {
                      if (el && feedback.id) listItemRefs.current.set(feedback.id, el);
                    }}
                    onClick={() => setSelectedFeedbackId(isSelected ? null : (feedback.id ?? null))}
                    sx={{
                      px: 1,
                      py: 0.5,
                      cursor: 'pointer',
                      borderRadius: 1,
                      backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                      outline: isSelected ? '1.5px solid rgba(25, 118, 210, 0.4)' : 'none',
                      '&:hover': { backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.12)' : 'rgba(0,0,0,0.04)' },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: '32px' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: FEEDBACK_TYPE_COLORS[feedback.type] || '#666' }} />
                        {feedback.uncertaintyEffect < 0
                          ? <TrendingDown sx={{ fontSize: 14, color: 'rgba(46, 83, 125, 0.9)' }} />
                          : <TrendingUp sx={{ fontSize: 14, color: 'rgba(198, 40, 40, 0.9)' }} />}
                      </Box>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={feedback.type}
                            size="small"
                            sx={{
                              height: 20, fontSize: '10px',
                              backgroundColor: FEEDBACK_TYPE_COLORS[feedback.type] || '#666',
                              color: 'white',
                              '& .MuiChip-label': { px: 1 },
                            }}
                          />
                          <Typography variant="caption" sx={{ fontWeight: 'bold', color: isSelected ? '#1976d2' : 'inherit' }}>
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
                );
              })}
          </React.Fragment>
        ))}
      </List>
    );
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', minHeight: 0, flex: 1 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexShrink: 0 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>Training Progress Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Review the impact of the latest training iteration across uncertainty and feedback.
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small"><Close /></IconButton>
      </Box>

      {/* Main layout: 2/3 left (map) + 1/3 right (chart + list) */}
      <Box sx={{ display: 'flex', gap: 1.5, flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Left: Uncertainty Change Map — takes 2/3 */}
        <Paper
          elevation={2}
          sx={{ flex: '2 1 66.67%', minWidth: 0, p: 1, display: 'flex', flexDirection: 'column' }}
        >
          <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <GridUncertaintyMap
              differenceImage={uncertaintyDifference?.difference_image ?? null}
              differenceRange={differenceRange}
              differenceStats={differenceStats}
              gridCoordinates={gridDifferenceData?.coordinates ?? []}
              gridDifferences={gridDifferenceData?.difference ?? []}
              gridCurrentValues={gridDifferenceData?.current_uncertainty ?? []}
              gridPreviousValues={gridDifferenceData?.previous_uncertainty ?? []}
              projectionBounds={uncertaintyDifference?.projection_bounds}
              currentTrajectories={currentTrajectories}
              previousTrajectories={previousTrajectories}
              loading={isDifferenceLoading}
              error={differenceError}
              title="Uncertainty Change Map"
            />
          </Box>
        </Paper>

        {/* Right: Waterfall chart (top) + Feedback history list (bottom) — 1/3 */}
        <Box sx={{ flex: '1 1 33.33%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

          {/* Waterfall chart */}
          <Paper
            elevation={2}
            sx={{ flex: '1 1 0', minHeight: 0, p: 1, display: 'flex', flexDirection: 'column' }}
          >
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <FeedbackWaterfallChart
                feedbackHistory={feedbackHistory}
                baselineUncertainty={baselineUncertainty}
                title="Feedback Impact on Uncertainty"
                selectedId={selectedFeedbackId}
                onSelectFeedback={setSelectedFeedbackId}
              />
            </Box>
            {/* Feedback type legend */}
            <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #eee', flexShrink: 0 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(FEEDBACK_TYPE_COLORS).map(([type, color]) => (
                  <Box key={type} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ width: 8, height: 8, backgroundColor: color, borderRadius: '2px' }} />
                    <Typography variant="caption" sx={{ fontSize: '10px' }}>{type}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Paper>

          {/* Feedback history list */}
          <Paper
            elevation={2}
            sx={{ flex: '1 1 0', minHeight: 0, p: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, flexShrink: 0 }}>
              Feedback History
              {selectedFeedbackId && (
                <Typography component="span" variant="caption" sx={{ ml: 1, color: '#1976d2' }}>
                  (1 selected — click to deselect)
                </Typography>
              )}
            </Typography>
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                overflowY: 'auto',
                pr: 0.5,
                '&::-webkit-scrollbar': { width: '6px' },
                '&::-webkit-scrollbar-track': { backgroundColor: '#f1f1f1', borderRadius: '3px' },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: '#c1c1c1', borderRadius: '3px',
                  '&:hover': { backgroundColor: '#a8a8a8' },
                },
              }}
            >
              {renderFeedbackHistory(feedbackHistory)}
            </Box>
          </Paper>

        </Box>
      </Box>
    </Box>
  );
};

export default TrainingProgressPanel;
