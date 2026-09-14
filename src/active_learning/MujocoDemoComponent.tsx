import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Divider, Paper, Typography } from '@mui/material';
import * as THREE from 'three';
import type { WebRTCDemoComponentProps, WebRTCFooterControls } from './WebRTCDemoComponent';
import {
  CORNER_VIDEO_CAMERA_POSE,
  getMujoco,
  getMujocoObservation,
  getTcpPoint,
  loadManifest,
  MujocoSceneRenderer,
  MujocoTrajectoryState,
  stepMujocoSimulation,
  writeBundleFiles,
} from './MujocoTrajectoryViewer';

type MujocoSample = {
  observation: number[];
  action: number[];
  reward: number;
  done: boolean;
  step: number;
  timestamp: number;
  envState: {
    state: MujocoTrajectoryState;
    observation: null;
    elapsed_steps: number;
  };
};

const KEY_ACTIONS: Record<string, number[]> = {
  w: [0, 1, 0, 0],
  s: [0, -1, 0, 0],
  a: [-1, 0, 0, 0],
  d: [1, 0, 0, 0],
  q: [0, 0, 0, -1],
  e: [0, 0, 0, 1],
  shift: [0, 0, 1, 0],
  control: [0, 0, -1, 0],
};

const PYTHON_CONTROL_FPS = 15;
const METAWORLD_HAND_INITIAL_POSITION = [0, 0.6, 0.2];
const METAWORLD_RESET_FRAMES = 50 * 5;
const METAWORLD_WELD_DATA = [0, 0, 0, 0, 0, 0, -1, 0, 0, 0, 5];

const resetMetaworldMocapWelds = (mujoco: any, model: any) => {
  if (!model.nmocap || !model.eq_data || !model.eq_type) {
    return;
  }
  const weldType = mujoco.mjtEq.mjEQ_WELD.value;
  const equalityDataWidth = Number(mujoco.mjNEQDATA) || METAWORLD_WELD_DATA.length;
  for (let equalityId = 0; equalityId < model.neq; equalityId += 1) {
    if (model.eq_type[equalityId] !== weldType) {
      continue;
    }
    const offset = equalityId * equalityDataWidth;
    for (let index = 0; index < METAWORLD_WELD_DATA.length; index += 1) {
      model.eq_data[offset + index] = METAWORLD_WELD_DATA[index];
    }
  }
};

const restorePythonMocapTarget = (data: any) => {
  if (data.mocap_pos?.length >= 3) {
    // SaveResetEnvWrapper only restores qpos/qvel. In the Python implementation,
    // the mocap target therefore stays at MetaWorld's reset hand position.
    data.mocap_pos.set(METAWORLD_HAND_INITIAL_POSITION);
  }
  if (data.mocap_quat?.length >= 4) {
    data.mocap_quat.set([1, 0, 1, 0]);
  }
};

const resetPythonCompatibleData = (
  mujoco: any,
  model: any,
  data: any,
) => {
  mujoco.mj_resetData(model, data);
  restorePythonMocapTarget(data);
  if (data.ctrl?.length >= 2) {
    data.ctrl[0] = -1;
    data.ctrl[1] = 1;
  }
  // MetaWorld's _reset_hand() performs 50 control steps with frame_skip=5.
  for (let frame = 0; frame < METAWORLD_RESET_FRAMES; frame += 1) {
    mujoco.mj_step(model, data);
  }
};

const loadPythonCompatibleState = (
  mujoco: any,
  model: any,
  data: any,
  state: MujocoTrajectoryState,
) => {
  resetPythonCompatibleData(mujoco, model, data);
  // SaveResetEnvWrapper then restores the requested qpos/qvel state.
  data.qpos.set(state.qpos);
  data.qvel.set(state.qvel);
  mujoco.mj_forward(model, data);
};

const getState = (data: any): MujocoTrajectoryState => ({
  qpos: Array.from(data.qpos as ArrayLike<number>),
  qvel: Array.from(data.qvel as ArrayLike<number>),
});

const combineActions = (pressedKeys: Set<string>) => {
  const action = [0, 0, 0, 0];
  pressedKeys.forEach((key) => {
    const keyAction = KEY_ACTIONS[key];
    if (!keyAction) {
      return;
    }
    keyAction.forEach((value, index) => {
      action[index] += value;
    });
  });
  return action.map((value) => Math.max(-1, Math.min(1, value)));
};

const estimateReward = (environmentId: string, observation: number[]) => {
  if (!environmentId.toLowerCase().includes('sweep-into') || observation.length < 7) {
    return 0;
  }
  const dx = observation[4];
  const dy = observation[5] - 0.84;
  const dz = observation[6] - 0.02;
  return Math.hypot(dx, dy, dz) <= 0.05 ? 10 : 0;
};

const MujocoDemoComponent: React.FC<WebRTCDemoComponentProps> = ({
  sessionId,
  experimentId,
  environmentId,
  coordinate,
  checkpoint,
  benchmarkId,
  episodeNum,
  step,
  initialStateMode,
  initialCameraPreset,
  onSubmit,
  onCancel,
  isSubmitting = false,
  footerContent,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mujocoRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const dataRef = useRef<any>(null);
  const rendererRef = useRef<MujocoSceneRenderer | null>(null);
  const initialStateRef = useRef<MujocoTrajectoryState | null>(null);
  const samplesRef = useRef<MujocoSample[]>([]);
  const pathRef = useRef<THREE.Vector3[]>([]);
  const previousObservationRef = useRef<number[] | undefined>(undefined);
  const pressedKeysRef = useRef(new Set<string>());
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [stepCount, setStepCount] = useState(0);

  const resetLocalDemo = useCallback(async () => {
    const mujoco = mujocoRef.current;
    const model = modelRef.current;
    const data = dataRef.current;
    const initialState = initialStateRef.current;
    if (!mujoco || !model || !data || !initialState) {
      return;
    }
    loadPythonCompatibleState(mujoco, model, data, initialState);
    samplesRef.current = [];
    pathRef.current = [getTcpPoint(data)];
    previousObservationRef.current = undefined;
    pressedKeysRef.current.clear();
    setStepCount(0);
    rendererRef.current?.setTrajectory(pathRef.current, '#ff6b35');
    rendererRef.current?.refresh(pathRef.current[0]);
  }, []);

  useEffect(() => {
    let disposed = false;

    const initialize = async () => {
      setStatus('loading');
      setError(null);
      try {
        let initialState: MujocoTrajectoryState | null = null;
        if (initialStateMode !== 'reset') {
          const initialStateResponse = await fetch('/demo_generation/browser_demo_initial_state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              environment_id: environmentId,
              experiment_id: Number(experimentId),
              benchmark_id: benchmarkId,
              checkpoint,
              episode_num: episodeNum,
              step,
              coordinate,
              projection_method: 'PCA',
            }),
          });
          if (!initialStateResponse.ok) {
            const body = await initialStateResponse.json().catch(() => ({}));
            throw new Error(body.detail ?? 'No browser-compatible initial state is available');
          }
          const initialPayload = await initialStateResponse.json();
          initialState = initialPayload.state as MujocoTrajectoryState;
        }
        const [mujoco, manifest] = await Promise.all([
          getMujoco(),
          loadManifest(environmentId),
        ]);
        await writeBundleFiles(mujoco, manifest);
        if (disposed || !containerRef.current) {
          return;
        }

        const model = (mujoco as any).MjModel.from_xml_path(`/metaworld/${manifest.root_xml}`);
        resetMetaworldMocapWelds(mujoco, model);
        const data = new (mujoco as any).MjData(model);
        if (initialState) {
          loadPythonCompatibleState(mujoco, model, data, initialState);
        } else {
          resetPythonCompatibleData(mujoco, model, data);
          initialState = getState(data);
        }

        const initialPoint = getTcpPoint(data);
        mujocoRef.current = mujoco;
        modelRef.current = model;
        dataRef.current = data;
        initialStateRef.current = initialState;
        pathRef.current = [initialPoint];
        rendererRef.current = new MujocoSceneRenderer(
          mujoco,
          model,
          data,
          containerRef.current,
          pathRef.current,
          [],
          '#ff6b35',
          initialCameraPreset === 'corner-video' ? CORNER_VIDEO_CAMERA_POSE : undefined,
          false,
        );
        rendererRef.current.refresh(initialPoint);
        setStatus('ready');
      } catch (initializeError) {
        if (!disposed) {
          setStatus('error');
          setError(initializeError instanceof Error ? initializeError.message : String(initializeError));
        }
      }
    };

    void initialize();
    return () => {
      disposed = true;
      rendererRef.current?.dispose();
      rendererRef.current = null;
      dataRef.current?.delete();
      dataRef.current = null;
      modelRef.current?.delete();
      modelRef.current = null;
      mujocoRef.current = null;
    };
  }, [
    benchmarkId,
    checkpoint,
    coordinate,
    environmentId,
    episodeNum,
    experimentId,
    initialStateMode,
    sessionId,
    step,
    initialCameraPreset,
  ]);

  const performStep = useCallback(() => {
    const mujoco = mujocoRef.current;
    const model = modelRef.current;
    const data = dataRef.current;
    const action = combineActions(pressedKeysRef.current);
    if (!mujoco || !model || !data || action.every((value) => value === 0)) {
      return;
    }

    const observation = getMujocoObservation(
      environmentId,
      data,
      previousObservationRef.current,
    );
    stepMujocoSimulation(mujoco, model, data, action);
    const point = getTcpPoint(data);
    const nextStep = samplesRef.current.length;
    samplesRef.current.push({
      observation,
      action,
      reward: estimateReward(environmentId, observation),
      done: false,
      step: nextStep,
      timestamp: Date.now(),
      envState: {
        state: getState(data),
        observation: null,
        elapsed_steps: nextStep + 1,
      },
    });
    previousObservationRef.current = observation;
    pathRef.current = [...pathRef.current, point];
    rendererRef.current?.setTrajectory(pathRef.current);
    rendererRef.current?.refresh(point);
    setStepCount(samplesRef.current.length);
  }, [environmentId]);

  useEffect(() => {
    if (status !== 'ready') {
      return;
    }
    const updateKey = (event: KeyboardEvent, pressed: boolean) => {
      const key = event.key.toLowerCase();
      if (!KEY_ACTIONS[key]) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, [contenteditable="true"]')) {
        return;
      }
      event.preventDefault();
      if (pressed) {
        pressedKeysRef.current.add(key);
      } else {
        pressedKeysRef.current.delete(key);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => updateKey(event, true);
    const onKeyUp = (event: KeyboardEvent) => updateKey(event, false);
    const clearPressedKeys = () => pressedKeysRef.current.clear();
    const interval = window.setInterval(() => {
      if (pressedKeysRef.current.size > 0) {
        performStep();
      }
    }, 1000 / PYTHON_CONTROL_FPS);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearPressedKeys);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearPressedKeys);
      clearPressedKeys();
    };
  }, [performStep, status]);

  const handleSubmit = useCallback(async () => {
    const samples = samplesRef.current;
    if (samples.length === 0) {
      return;
    }
    const payload = {
      session_id: sessionId,
      experiment_id: Number(experimentId),
      environment_id: environmentId,
      checkpoint,
      browser_mujoco_demo: {
        obs: samples.map((sample) => sample.observation),
        actions: samples.map((sample) => sample.action),
        rewards: samples.map((sample) => sample.reward),
        dones: samples.map((_, index) => index === samples.length - 1),
        infos: samples.map(() => ({})),
        env_states: samples.map((sample) => sample.envState),
        episode_steps: samples.map((sample) => sample.step),
        timestamps: samples.map((sample) => sample.timestamp),
        metadata: {
          source: 'browser_mujoco',
          coordinate: coordinate ?? null,
          correction_episode_num: episodeNum ?? null,
          correction_step: step ?? null,
          rendered_frames_saved: false,
        },
      },
    };
    await onSubmit(payload);
  }, [
    checkpoint,
    coordinate,
    environmentId,
    episodeNum,
    experimentId,
    onSubmit,
    sessionId,
    step,
  ]);

  const controls: WebRTCFooterControls = useMemo(() => ({
    connected: status === 'ready',
    isSubmitting,
    onCancel,
    onSubmit: () => {
      void handleSubmit();
    },
    reset: resetLocalDemo,
  }), [handleSubmit, isSubmitting, onCancel, resetLocalDemo, status]);

  if (status === 'error') {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography color="error" variant="body2">{error}</Typography>
        <Button sx={{ mt: 1 }} variant="outlined" onClick={onCancel}>Close</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ px: 1.5, py: 1, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            Browser MuJoCo demo (W/A/S/D, Shift/Ctrl, Q/E)
          </Typography>
          <Typography variant="caption" color="text.secondary">Steps: {stepCount}</Typography>
        </Box>
        <Divider />
        <Box sx={{ position: 'relative', flex: 1, minHeight: 320 }}>
          <Box ref={containerRef} sx={{ position: 'absolute', inset: 0 }} />
          {status === 'loading' && (
            <Box sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              gap: 1,
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'rgba(255,255,255,0.82)',
            }}>
              <CircularProgress size={22} />
              <Typography variant="body2">Loading browser MuJoCo…</Typography>
            </Box>
          )}
        </Box>
        <Divider />
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', gap: 1 }}>
          {footerContent ? footerContent(controls) : (
            <>
              <Button size="small" onClick={onCancel}>Cancel</Button>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" onClick={() => void resetLocalDemo()}>
                  Reset
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={isSubmitting || stepCount === 0}
                  onClick={() => void handleSubmit()}
                >
                  {isSubmitting ? <CircularProgress size={16} sx={{ mr: 1 }} color="inherit" /> : null}
                  Submit Demo
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Paper>
    </Box>
  );
};

export default MujocoDemoComponent;
