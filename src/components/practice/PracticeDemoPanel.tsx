import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Paper, Typography, useTheme } from '@mui/material';
import axios from 'axios';

import { useAppState } from '../../AppStateContext';
import {
  useOptionalActiveLearningDispatch,
  useOptionalActiveLearningState,
  UserDemoTrajectory,
} from '../../ActiveLearningContext';
import WebRTCDemoComponent from '../../active_learning/WebRTCDemoComponent';
import { computeTrajectoryColors, getFallbackColor } from '../../active_learning/utils/trajectoryColors';
import { Legend } from '../../active_learning/components/ProjectionLegends';

const DEFAULT_CANVAS_SIZE = 360;
const PRACTICE_EXPERIMENT_ID = "1"; // Special ID for practice mode
const PRACTICE_ENVIRONMENT_ID = 'metaworld-sweep-into-v3';

const PracticeDemoPanel: React.FC = () => {
  const theme = useTheme();
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState(DEFAULT_CANVAS_SIZE);
  const [demoInstance, setDemoInstance] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const appState = useAppState();
  const activeLearningState = useOptionalActiveLearningState();
  const activeLearningDispatch = useOptionalActiveLearningDispatch();

  const userTrajectories = useMemo(() => {
    return activeLearningState?.userGeneratedTrajectories ?? [];
  }, [activeLearningState?.userGeneratedTrajectories]);

  useEffect(() => {
    const element = canvasWrapperRef.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = entry.contentRect.width;
      setCanvasSize(Math.max(220, Math.min(width, 420)));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = canvasSize;
    const height = canvasSize;

    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.palette.mode === 'dark' ? '#1f1f1f' : '#fafafa';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = theme.palette.divider;
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);

    const trajectories = userTrajectories
      .map((trajectory, index) => ({
        key: trajectory.id ?? `trajectory-${index}`,
        points: trajectory.projection ?? [],
      }))
      .filter(({ points }) => points && points.length > 1);

    const allPoints = trajectories.flatMap(({ points }) => points);

    if (allPoints.length === 0) {
      ctx.fillStyle = theme.palette.text.secondary;
      ctx.font = '14px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Recorded user demos will appear here.', width / 2, height / 2);
      ctx.fillText('Complete a demo to see it reflected on the projection.', width / 2, height / 2 + 20);
      return;
    }

    const xs = allPoints.map((point) => point[0]);
    const ys = allPoints.map((point) => point[1]);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const xRange = maxX - minX || 1;
    const yRange = maxY - minY || 1;

    const padding = 20;
    const projectX = (value: number) => padding + ((value - minX) / xRange) * (width - 2 * padding);
    const projectY = (value: number) => height - padding - ((value - minY) / yRange) * (height - 2 * padding);

    const trajectoryMap = new Map<number, number[][]>();
    trajectories.forEach(({ points }, idx) => {
      trajectoryMap.set(idx, points);
    });
    const colorMap = computeTrajectoryColors(trajectoryMap);

    trajectories.forEach(({ points }, idx) => {
      const color = colorMap.get(idx) ?? getFallbackColor(idx);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      ctx.moveTo(projectX(points[0][0]), projectY(points[0][1]));
      for (let i = 1; i < points.length; i += 1) {
        ctx.lineTo(projectX(points[i][0]), projectY(points[i][1]));
      }
      ctx.stroke();

      const startX = projectX(points[0][0]);
      const startY = projectY(points[0][1]);
      ctx.fillStyle = '#4CAF50';
      ctx.beginPath();
      ctx.moveTo(startX - 8, startY + 8);
      ctx.lineTo(startX + 8, startY);
      ctx.lineTo(startX - 8, startY - 8);
      ctx.closePath();
      ctx.fill();

      const endX = projectX(points[points.length - 1][0]);
      const endY = projectY(points[points.length - 1][1]);
      ctx.fillStyle = '#F44336';
      ctx.fillRect(endX - 6, endY - 6, 12, 12);
    });
  }, [userTrajectories, canvasSize, theme.palette.mode, theme.palette.divider]);

  useEffect(() => () => {
    if (activeLearningDispatch) {
      activeLearningDispatch({ type: 'REMOVE_USER_GENERATED_TRAJECTORIES_BY_SOURCE', payload: 'practice' });
    }
  }, [activeLearningDispatch]);

  const sessionId = appState.sessionId && appState.sessionId !== '-' ? appState.sessionId : 'practice-session';
  const checkpoint = Number(appState.selectedCheckpoint ?? 0);
  const userTrajectoryCount = activeLearningState?.userGeneratedTrajectories?.length ?? 0;

  const handleSaveDemo = useCallback(async (practiceSessionId: string) => {

    setIsSaving(true);

    try {
      const payload: Record<string, any> = {
        session_id: practiceSessionId,
        projection_method: 'PCA',
      };
      if (!Number.isNaN(checkpoint)) {
        payload.checkpoint = Number(checkpoint);
      }

      const response = await axios.post('/demo_generation/save_webrtc_demo', payload);
      const data = response.data;

      if (data?.success && data.artifacts) {
        const artifacts = data.artifacts;
        const palette = ['#FF6B35', '#FFB703', '#8338EC', '#3A86FF', '#219EBC'];
        const color = palette[userTrajectoryCount % palette.length];

        const trajectory: UserDemoTrajectory = {
          id: `${practiceSessionId}-${Date.now()}`,
          projection: (artifacts.projection ?? []).map((pt: number[]) => [...pt]),
          episodeIndices: artifacts.episode_indices ?? [],
          rewards: artifacts.rewards ?? [],
          dones: artifacts.dones ?? [],
          videoPath: artifacts.video_path ?? null,
          metadata: { ...(artifacts.metadata ?? {}), source: 'practice', color },
          demoFile: artifacts.demo_file ?? null,
          projectionFile: artifacts.projection_file ?? null,
          totalReward: artifacts.total_reward,
          source: 'practice',
          phase: activeLearningState?.currentPhase ?? 0,
        };

        if (activeLearningDispatch) {
          activeLearningDispatch({ type: 'ADD_USER_GENERATED_TRAJECTORY', payload: trajectory });
        }
      } else {
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error saving practice demo:', message);
    } finally {
      setIsSaving(false);
    }
  }, [activeLearningDispatch, checkpoint, userTrajectoryCount]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h6" gutterBottom>
        Hands-on Practice
      </Typography>

      <Typography variant="body2" color="text.secondary">
        For demos and corrections, you can directly control the robot using keyboard inputs. Use the following playground to practice teleoperating the robot in the environment.
        You can also plot the generated trajectories in a preview of the 2D projections we will use for active learning.
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(280px, 360px) minmax(320px, 1fr)' },
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <Typography variant="subtitle1" gutterBottom>
            State Sequence Preview
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This 2D projection plots the robot's trajectory for each recorded demo, highlighting where runs begin and end.
          </Typography>
          <Box ref={canvasWrapperRef} sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <canvas ref={canvasRef} />
          </Box>
          <Box>
            <Legend />
          </Box>
        </Paper>

        <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="subtitle1">Interactive Practice Demo</Typography>
          <Typography variant="body2" color="text.secondary">
            Use the keyboard controls (W/A/S/D, Q/E, Shift/Ctrl) to teleoperate the robot. You can save a demo to add
            its trajectory to the state projection or reset the environment to try again.
          </Typography>

            <WebRTCDemoComponent
              key={demoInstance}
              sessionId={`${sessionId}_practice`}
              experimentId={PRACTICE_EXPERIMENT_ID}
              environmentId={PRACTICE_ENVIRONMENT_ID}
              checkpoint={Number.isNaN(checkpoint) ? undefined : checkpoint}
              episodeNum={0}
              step={0}
              onSubmit={() => { /* no-op: practice mode */ }}
              onCancel={() => { setDemoInstance((prev) => prev + 1); }}
              footerContent={({ connected, reset }) => {
                const practiceSessionId = `${sessionId}_practice`;
                const handleReset = () => {
                  void reset();
                  setDemoInstance((prev) => prev + 1);
                };

                return (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Update the projection to plot the trajectory, or reset to start fresh.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        size="small"
                        disabled={!connected || isSaving || !activeLearningDispatch}
                        onClick={() => { void handleSaveDemo(practiceSessionId); }}
                      >
                        {isSaving ? <CircularProgress size={16} sx={{ color: 'white' }} /> : 'UPDATE PREVIEW'}
                      </Button>
                      <Button
                        variant="outlined"
                        size="small"
                        disabled={!connected}
                        onClick={handleReset}
                      >
                        Reset Demo
                      </Button>
                    </Box>
                  </Box>
                );
              }}
            />
        </Paper>
      </Box>
    </Box>
  );
};

export default PracticeDemoPanel;
