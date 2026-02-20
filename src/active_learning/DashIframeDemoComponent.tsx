import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Divider, Paper, Typography } from '@mui/material';
import { useDashIframe } from './dash/useDashIframe';
import type { WebRTCDemoComponentProps, WebRTCFooterControls } from './WebRTCDemoComponent';
import type { DashStatePayload } from './dash/dash-iframe-protocol';

type KeyState = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  brake: boolean;
};

type DashSample = {
  observation: number[];
  action: number[];
  reward: number;
  done: boolean;
  step: number;
  timestamp: number;
};

const DEFAULT_PLAYER_URL = (import.meta.env.VITE_DASH_PLAYER_URL as string | undefined) ?? 'http://localhost:5173';
const DEFAULT_PLAYER_ORIGIN = (import.meta.env.VITE_DASH_PLAYER_ORIGIN as string | undefined) ?? 'http://localhost:5173';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function keysToAction(keys: KeyState): number[] {
  const steer = clamp((keys.right ? 1 : 0) - (keys.left ? 1 : 0), -1, 1);
  const gas = keys.forward ? 1 : 0;
  const brake = keys.brake || keys.backward ? 1 : 0;
  return [steer, gas, brake];
}

function toObservationVector(state: DashStatePayload): number[] {
  return [
    Number(state.car?.speed ?? 0),
    Number(state.car?.rot ?? 0),
    Number(state.station ?? 0),
    Number(state.latitude ?? 0),
    Number(state.car?.x ?? 0),
    Number(state.car?.y ?? 0),
    Number(state.simTime ?? 0),
    state.paused ? 1 : 0,
  ];
}

const DashIframeDemoComponent: React.FC<WebRTCDemoComponentProps> = ({
  sessionId,
  experimentId,
  environmentId,
  coordinate,
  checkpoint,
  episodeNum,
  step,
  onSubmit,
  onCancel,
  isSubmitting = false,
  footerContent,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [stepCount, setStepCount] = useState(0);
  const [samples, setSamples] = useState<DashSample[]>([]);
  const keysRef = useRef<KeyState>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    brake: false,
  });
  const lastStateRef = useRef<DashStatePayload | null>(null);

  const dash = useDashIframe({ iframeRef, playerOrigin: DEFAULT_PLAYER_ORIGIN });

  useEffect(() => {
    if (!dash.lastState) return;
    lastStateRef.current = dash.lastState;
  }, [dash.lastState]);

  const appendSample = useCallback((state: DashStatePayload) => {
    setSamples((prev) => {
      const nextStep = prev.length;
      const previousState = prev.length ? prev[prev.length - 1] : null;
      const previousStation = previousState ? previousState.observation[2] : Number(state.station ?? 0);
      const reward = Number(state.station ?? 0) - previousStation;
      const next: DashSample = {
        observation: toObservationVector(state),
        action: keysToAction(keysRef.current),
        reward,
        done: false,
        step: nextStep,
        timestamp: Date.now(),
      };
      return [...prev, next];
    });
    setStepCount((prev) => prev + 1);
  }, []);

  useEffect(() => {
    if (!dash.isReady) return;
    let mounted = true;

    void (async () => {
      try {
        await dash.init({
          startMode: 'manual',
          paused: true,
        });
        if (!mounted) return;
        setStatus('ready');
      } catch (err) {
        if (!mounted) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      }
    })();

    return () => {
      mounted = false;
    };
  }, [dash, sessionId, experimentId, environmentId]);

  useEffect(() => {
    if (!dash.isReady || status !== 'ready') return;
    const timer = window.setInterval(() => {
      void dash
        .getState()
        .then((message: any) => {
          const payload = message?.payload as DashStatePayload | undefined;
          if (!payload || typeof payload !== 'object') return;
          appendSample(payload);
        })
        .catch(() => undefined);
    }, 100);
    return () => window.clearInterval(timer);
  }, [appendSample, dash, status]);

  useEffect(() => {
    if (!dash.isReady || status !== 'ready') return;

    const updateKey = (key: string, isDown: boolean) => {
      switch (key) {
        case 'w':
        case 'W':
          keysRef.current.forward = isDown;
          return true;
        case 's':
        case 'S':
          keysRef.current.backward = isDown;
          return true;
        case 'a':
        case 'A':
          keysRef.current.left = isDown;
          return true;
        case 'd':
        case 'D':
          keysRef.current.right = isDown;
          return true;
        case ' ':
          keysRef.current.brake = isDown;
          return true;
        default:
          return false;
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!updateKey(event.key, true)) return;
      event.preventDefault();
      void dash.setKeys(keysRef.current);
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (!updateKey(event.key, false)) return;
      event.preventDefault();
      void dash.setKeys(keysRef.current);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      void dash.clearKeys();
    };
  }, [dash, status]);

  const handleReset = useCallback(async () => {
    await dash.reset();
    setSamples([]);
    setStepCount(0);
  }, [dash]);

  const handleSubmit = useCallback(async () => {
    const currentSamples = samples.length > 0
      ? samples
      : (lastStateRef.current ? [{
        observation: toObservationVector(lastStateRef.current),
        action: [0, 0, 0],
        reward: 0,
        done: false,
        step: 0,
        timestamp: Date.now(),
      }] : []);

    const dones = currentSamples.map((_, idx) => idx === currentSamples.length - 1);
    const payload = {
      session_id: sessionId,
      experiment_id: Number(experimentId),
      environment_id: environmentId,
      checkpoint,
      dash_demo: {
        obs: currentSamples.map((item) => item.observation),
        actions: currentSamples.map((item) => item.action),
        rewards: currentSamples.map((item) => item.reward),
        dones,
        episode_steps: currentSamples.map((item) => item.step),
        timestamps: currentSamples.map((item) => item.timestamp),
        metadata: {
          source: 'dash_iframe',
          coordinate: coordinate ?? null,
          correction_episode_num: episodeNum ?? null,
          correction_step: step ?? null,
          player_url: DEFAULT_PLAYER_URL,
        },
      },
    };
    await onSubmit(payload);
  }, [samples, sessionId, experimentId, environmentId, checkpoint, coordinate, episodeNum, step, onSubmit]);

  const controls: WebRTCFooterControls = useMemo(() => ({
    connected: status === 'ready',
    isSubmitting,
    onCancel,
    onSubmit: () => {
      void handleSubmit();
    },
    reset: handleReset,
  }), [handleReset, handleSubmit, isSubmitting, onCancel, status]);

  if (status === 'loading') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 2, gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2">Initializing Dash demo session...</Typography>
      </Box>
    );
  }

  if (status === 'error') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 2, gap: 2 }}>
        <Typography variant="body2" color="error">Failed to initialize Dash iframe: {error ?? 'unknown error'}</Typography>
        <Button variant="outlined" onClick={onCancel}>Close</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Paper sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ px: 1.5, py: 1, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2" color="text.secondary">
            Dash driving demo (W/A/S/D + Space)
          </Typography>
          <Typography variant="caption" color="text.secondary">Samples: {stepCount}</Typography>
        </Box>
        <Divider />
        <Box sx={{ p: 1, flex: 1, minHeight: 320 }}>
          <iframe
            ref={iframeRef}
            src={DEFAULT_PLAYER_URL}
            title="Dash driving demo"
            style={{ width: '100%', height: '100%', border: '1px solid rgba(0,0,0,0.12)', borderRadius: 4 }}
          />
        </Box>
        <Divider />
        <Box sx={{ p: 1, display: 'flex', justifyContent: 'space-between', gap: 1, alignItems: 'center' }}>
          {footerContent ? (
            footerContent(controls)
          ) : (
            <>
              <Button size="small" onClick={onCancel}>Cancel</Button>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" onClick={() => void handleReset()}>Reset</Button>
                <Button size="small" variant="contained" disabled={isSubmitting} onClick={() => void handleSubmit()}>
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

export default DashIframeDemoComponent;

