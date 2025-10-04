import React, { useState, useRef, useEffect, useMemo, useCallback, startTransition } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  IconButton,
  Paper,
  Button,
  Slider,
  Radio,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import {
  Image as ImageIcon,
  ThumbDown,
  ThumbUp,
  PlayArrow,
  Pause,
  ModeEdit,
} from '@mui/icons-material';
import { useAppState, useAppDispatch } from '../AppStateContext';
import {
  useActiveLearningState,
  useActiveLearningDispatch,
  UserDemoTrajectory,
  FeedbackHistoryEntry,
} from '../ActiveLearningContext';
import * as d3 from 'd3';
import { IDfromEpisode } from '../id';
import { useGetter } from '../getter-context';
import { Episode, FeedbackType, Feedback } from '../types';
import { getEpisodeColor as getEpisodeColorFromUtil } from './utils/trajectoryColors';
import axios from 'axios';
import WebRTCDemoComponent from './WebRTCDemoComponent';
import TimelineComponent from './TimelineComponent';
import { OnboardingHighlight, useOnboarding } from './OnboardingSystem';

// ————————————————————————————————————————————————————————————
// Visual helpers
// ————————————————————————————————————————————————————————————
const shellSx = {
  height: '100%',
  maxHeight: '100vh',
  display: 'flex',
  flexDirection: 'column' as const,
  p: 1.5,
  overflow: 'auto',
  position: 'relative' as const,
  gap: 1.5,
};

const sectionCardSx = {
  border: '1px solid',
  borderColor: 'divider',
  borderRadius: 2,
  p: 2,
  backgroundColor: 'background.paper',
  marginTop: '1vh',
};

// Distinctive evaluation slider: white/grey timeline depending on theme
const evalSliderSx = (theme: any) => ({
  height: 4,
  '& .MuiSlider-rail': {
    opacity: 1,
    backgroundColor:
      theme.palette.mode === 'dark'
        ? alpha(theme.palette.common.white, 0.18)
        : theme.palette.grey[300],
  },
  '& .MuiSlider-track': {
    border: 'none',
    backgroundColor:
      theme.palette.mode === 'dark'
        ? theme.palette.common.white
        : theme.palette.grey[700],
  },
  '& .MuiSlider-thumb': {
    width: 16,
    height: 16,
    boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
    '&:focus, &:hover, &.Mui-active': { boxShadow: '0 0 0 6px rgba(0,0,0,0.08)' },
  },
  '& .MuiSlider-mark': {
    width: 2,
    height: 6,
    borderRadius: 1,
    backgroundColor:
      theme.palette.mode === 'dark' ? theme.palette.grey[600] : theme.palette.grey[300],
  },
  '& .MuiSlider-valueLabel': {
    background: 'transparent',
    color: theme.palette.text.secondary,
  },
});

const toolbarSx = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 1,
};

// ————————————————————————————————————————————————————————————
// Helper function to map feedback type to category
// ————————————————————————————————————————————————————————————
const getFeedbackCategory = (feedbackType: FeedbackType, selectionType?: string): string => {
  switch (feedbackType) {
    case FeedbackType.Evaluative:
      return 'Rating';
    case FeedbackType.Comparative:
      return 'Comparison';
    case FeedbackType.Corrective:
      return 'Correction';
    case FeedbackType.Demonstrative:
      return 'Demo';
    case FeedbackType.ClusterRating:
      return 'Cluster';
    default:
      return 'Rating';
  }
};

const DEFAULT_UNCERTAINTY_EFFECTS: Record<string, number> = {
  Rating: -0.02,
  Comparison: -0.08,
  Correction: 0.04,
  Demo: -0.12,
  Cluster: -0.05,
};

const MergedSelectionFeedback = () => {
  const appState = useAppState();
  const appDispatch = useAppDispatch();
  const activeLearningState = useActiveLearningState();
  const activeLearningDispatch = useActiveLearningDispatch();
  const { getVideoURL } = useGetter();
  const { triggerStepComplete } = useOnboarding();

  // State for videos and interaction
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const userDemoVideoRef = useRef<HTMLVideoElement | null>(null);
  const [videoURLs, setVideoURLs] = useState<Map<string, string>>(new Map<string, string>());
  const [clusterFrameImages, setClusterFrameImages] = useState<string[]>([]);
  const [coordinateFrameImage, setCoordinateFrameImage] = useState<string | null>(null);
  const [selectionInstance, setSelectionInstance] = useState(0); // Unique identifier for each selection
  const lastUpdateStepRef = useRef(-1); // For tracking projection sync updates

  // Feedback state
  const [value, setValue] = useState(5);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [useWebRTC, setUseWebRTC] = useState(false);
  const [useWebRTCCorrection, setUseWebRTCCorrection] = useState(false);
  const [savingDemo, setSavingDemo] = useState(false);
  const [currentPlaying, setCurrentPlaying] = useState<number | null>(null);
  const [selectedStep, setSelectedStep] = useState(0);
  const [showCorrectionInterface, setShowCorrectionInterface] = useState(false);
  const [videoProgress, setVideoProgress] = useState<Map<number, number>>(() => new Map());
  const [userDemoVideoStatus, setUserDemoVideoStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const containerRef = useRef<HTMLDivElement>(null);
  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState<number>(600);

  const STEP_UPDATE_STRIDE = 20; // or 20


  // avoid stale selectedStep in the timeupdate closure
  const selectedStepRef = useRef<number>(0);
  useEffect(() => { selectedStepRef.current = selectedStep; }, [selectedStep]);

  // Use selection directly from state
  const selection = useMemo(() => activeLearningState.selection || [], [activeLearningState.selection]);
  const allEpisodes = useMemo(() => {
    const episodes = appState.episodeIDsChronologically || [];
    const selectedCheckpoint = appState.selectedCheckpoint;

    if (selectedCheckpoint === undefined || selectedCheckpoint === null || selectedCheckpoint < 0) {
      return [];
    }

    const checkpointStep = Number(selectedCheckpoint);
    if (Number.isNaN(checkpointStep)) {
      return [];
    }

    // Filter episodes to only include those from the current checkpoint
    return episodes.filter((episode: Episode) => episode.checkpoint_step === checkpointStep);
  }, [appState.episodeIDsChronologically, appState.selectedCheckpoint]);
  // Extract selection type and data
  const userGeneratedTrajectories = activeLearningState.userGeneratedTrajectories || [];

  const selectionData = useMemo(() => {
    if (selection.length === 0) return { type: 'none', data: [] } as any;
    if (selection.length === 1) {
      const item: any = selection[0];
      if (item.type === 'user_demo') {
        const trajectoryId = item.data?.trajectoryId;
        const pointIndex =
          typeof item.data?.pointIndex === 'number' && Number.isFinite(item.data.pointIndex)
            ? item.data.pointIndex
            : null;
        const trajectory = userGeneratedTrajectories.find((t) => t.id === trajectoryId) || null;
        return {
          type: 'user_demo',
          data: {
            trajectory,
            trajectoryId,
            pointIndex,
            raw: item.data ?? null,
          },
        } as any;
      }
      if (item.type === 'cluster') return { type: 'cluster', label: (item as any).label, data: item.data } as any;
      if (item.type === 'coordinate') return { type: 'coordinate', data: [item.data] } as any;
      return { type: 'state', data: [item.data] } as any;
    }
    const allTrajectories = selection.every((item: any) => item.type === 'state');
    if (allTrajectories) return { type: 'multi_trajectory', data: selection.map((item: any) => item.data) } as any;
    return { type: 'mixed', data: selection } as any;
  }, [selection, userGeneratedTrajectories]);

  const resolveDemoPath = useCallback((path?: string | null) => {
    if (!path) return null;
    if (/^https?:\/\//.test(path)) return path;

    const sanitized = path.replace(/\\/g, '/');
    let normalized = sanitized;
    if (normalized.startsWith('./')) {
      normalized = normalized.slice(2);
    }
    normalized = normalized.replace(/^\/+/u, '');

    if (normalized.startsWith('data/')) {
      return `/datafiles/${normalized.slice('data/'.length)}`;
    }

    return `/${normalized}`;
  }, []);

  const waitForVideoAvailability = useCallback(
    async (videoPath?: string | null, timeoutMs = 8000, intervalMs = 500) => {
      if (!videoPath) return false;
      const resolvedPath = resolveDemoPath(videoPath);
      if (!resolvedPath) return false;

      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          const response = await fetch(resolvedPath, {
            method: 'HEAD',
            cache: 'no-store',
          });
          if (response.ok) {
            return true;
          }
        } catch (error) {
          // Asset not ready yet; retry until timeout
        }
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
      return false;
    },
    [resolveDemoPath]
  );

  // Initialize videoRefs based on selection length
  useEffect(() => { videoRefs.current = Array(selection.length).fill(null); }, [selection.length]);

  // Reset feedback state when the logical selection changes (ignore step-only changes)
  const prevResetKeyRef = useRef<string | null>(null);
  const selectionResetKey = useMemo(() => {
    try {
      // Normalize selection so that for state selections only the episode matters (ignore step)
      const items = (selection || []).map((item: any) => {
        if (!item) return null;
        const t = item.type;
        if (t === 'state' && item.data) {
          const ep = typeof item.data === 'number' ? item.data : item.data.episode;
          return { type: 'state', episode: ep };
        }
        if (t === 'trajectory') {
          // trajectories are episode-level
          const ep = typeof item.data === 'number' ? item.data : item.data?.episode;
          return { type: 'trajectory', episode: ep };
        }
        if (t === 'user_demo') {
          const trajectoryId = item.data?.trajectoryId ?? item.data?.id;
          return { type: 'user_demo', trajectoryId };
        }
        if (t === 'cluster') {
          // clusters depend on the set of indices (order-insensitive)
          const indices: number[] = Array.from(new Set((item.data || []) as number[])).sort((a,b) => a-b);
          return { type: 'cluster', indices };
        }
        if (t === 'coordinate') {
          const { x, y } = item.data || {};
          return { type: 'coordinate', x, y };
        }
        return item;
      }).filter(Boolean);
      return JSON.stringify(items);
    } catch {
      return 'unknown';
    }
  }, [selection]);

  useEffect(() => {
    if (prevResetKeyRef.current === selectionResetKey) return; // no logical change
    prevResetKeyRef.current = selectionResetKey;
    setValue(5);
    setChosenId(null);
    setSubmitted(false);
    setUseWebRTC(false);
    setUseWebRTCCorrection(false);
    setCoordinateFrameImage(null);
    setSelectedStep(0);
    setShowCorrectionInterface(false);
    lastUpdateStepRef.current = -1; // Reset sync tracking
  }, [selectionResetKey]);

  // Measure available width for the inline timeline so it can use full width
  useEffect(() => {
    const el = timelineContainerRef.current;
    if (!el) return;
    const ro = new (window as any).ResizeObserver((entries: any[]) => {
      for (const entry of entries) {
        const w = Math.floor(entry.contentRect.width);
        if (w && w !== timelineWidth) setTimelineWidth(w);
      }
    });
    ro.observe(el);
    // initial
    const initialWidth = Math.floor(el.getBoundingClientRect().width);
    if (initialWidth && initialWidth !== timelineWidth) setTimelineWidth(initialWidth);
    return () => { try { ro.disconnect(); } catch { /* noop */ } };
  }, [timelineContainerRef.current]);

  const currentStateData: any = selectionData.type === 'state' && selectionData.data?.[0] ? selectionData.data[0] : null;
  const currentStep = currentStateData?.step;

  const getEpisodeLength = useCallback(
    (episodeIdx: number) => {
      const episodeIndices = activeLearningState.episodeIndices || [];
      if (episodeIndices.length === 0) return 100;
      const statesInEpisode = episodeIndices.filter((idx: number) => idx === episodeIdx).length;
      return Math.max(1, statesInEpisode);
    },
    [activeLearningState.episodeIndices]
  );

  useEffect(() => {
    if (selectionData.type === 'state' && currentStateData && currentStep !== null) {
      setSelectedStep(currentStep);
    } else if (selectionData.type === 'user_demo') {
      const pointIndex = (selectionData as any).data?.pointIndex;
      if (typeof pointIndex === 'number' && Number.isFinite(pointIndex)) {
        setSelectedStep(pointIndex);
      } else {
        setSelectedStep(0);
      }
    } else if (selectionData.type === 'trajectory' && selection.length === 2) {
      const stateSelection: any = (selection as any).find((item: any) => item.type === 'state');
      if (stateSelection && stateSelection.data?.step !== undefined) setSelectedStep(stateSelection.data.step);
      else setSelectedStep(0);
    } else {
      setSelectedStep(0);
    }
  }, [selectionData.type, currentStateData, currentStep, selection]);

  useEffect(() => {
    if (selectionData.type !== 'user_demo') {
      setUserDemoVideoStatus('idle');
      return;
    }

    const data = (selectionData as any).data || {};
    const trajectory: UserDemoTrajectory | null = data?.trajectory ?? null;
    const trajectoryId: string | undefined = trajectory?.id ?? data?.trajectoryId;
    const rawVideoPath: string | undefined = data?.raw?.videoPath;
    const resolved =
      (trajectoryId ? videoURLs.get(trajectoryId) : undefined) ||
      (trajectory?.videoPath ? resolveDemoPath(trajectory.videoPath) : null) ||
      (rawVideoPath ? resolveDemoPath(rawVideoPath) : null);

    if (!resolved) {
      setUserDemoVideoStatus('idle');
      return;
    }

    setUserDemoVideoStatus((prev) => (prev === 'idle' ? 'loading' : prev));
  }, [selectionData, videoURLs, resolveDemoPath]);

  useEffect(() => {
    if (selectionData.type !== 'user_demo') return;

    const data = (selectionData as any).data || {};
    const trajectory: UserDemoTrajectory | null = data?.trajectory ?? null;
    const pointIndex =
      typeof data?.pointIndex === 'number' && Number.isFinite(data.pointIndex)
        ? data.pointIndex
        : null;
    const videoElement = userDemoVideoRef.current;

    if (!trajectory || videoElement === null || pointIndex === null) return;

    const totalSteps = Array.isArray(trajectory.projection) ? trajectory.projection.length : 0;
    if (totalSteps <= 0) return;

    const clampedIndex = Math.max(0, Math.min(pointIndex, totalSteps - 1));

    const syncVideoTime = () => {
      const duration = videoElement.duration;
      if (!Number.isFinite(duration) || duration <= 0) return;
      const denominator = Math.max(totalSteps - 1, 1);
      const targetTime = denominator > 0 ? (clampedIndex / denominator) * duration : 0;
      if (!Number.isFinite(targetTime)) return;
      if (Math.abs(videoElement.currentTime - targetTime) > 0.1) {
        videoElement.currentTime = targetTime;
      }
    };

    if (videoElement.readyState >= 1 && Number.isFinite(videoElement.duration) && videoElement.duration > 0) {
      syncVideoTime();
      return;
    }

    const handleLoadedMetadata = () => {
      syncVideoTime();
    };

    videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    return () => {
      videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [selectionData]);

  // Fetch coordinate frame when coordinate is selected
  useEffect(() => {
    if (selectionData.type === 'coordinate' && selectionData.data && selectionData.data.length > 0) {
      const coordinate = selectionData.data[0];
      const fetchCoordinateFrame = async () => {
        try {
          const firstEpisode = allEpisodes.find((episode: any) => episode.benchmark_id === appState.selectedExperiment.id);
          if (!firstEpisode) { setCoordinateFrameImage(null); return; }
          const response = await fetch('/demo_generation/coordinate_to_render', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coordinates: [coordinate.x, coordinate.y], env_id: firstEpisode.env_name, exp_id: appState.selectedExperiment.id }),
          });
          if (response.ok) {
            const result = await response.json();
            if (result.success && result.render_frame) setCoordinateFrameImage(`data:image/png;base64,${result.render_frame}`);
            else setCoordinateFrameImage(null);
          } else { setCoordinateFrameImage(null); }
        } catch (error) { setCoordinateFrameImage(null); }
      };
      fetchCoordinateFrame();
    } else { setCoordinateFrameImage(null); }
  }, [selectionData, allEpisodes, appState.selectedExperiment.id]);

  // Fetch cluster frame images from backend
  const fetchClusterFrames = useCallback(async (clusterIndices: number[], episodeData: any[]) => {
    try {
      const response = await fetch('/data/get_cluster_frames', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cluster_indices: clusterIndices, episode_data: episodeData, max_states_to_show: 12 }),
      });
      if (!response.ok) throw new Error('Failed to fetch cluster frames');
      const frameImages = await response.json();
      setClusterFrameImages(frameImages);
    } catch (error) { setClusterFrameImages([]); }
  }, []);

  // Fetch video URLs for trajectories
  useEffect(() => {
    if (selectionData.type === 'state' || selectionData.type === 'multi_trajectory') {
      const fetchVideos = async () => {
        setLoading(true);
        const newVideoURLMap = new Map<string, string>();
        if (selectionData.type === 'state') {
          const stateData: any = selectionData.data[0];
          let episodeIdx: number = typeof stateData === 'number' ? stateData : stateData.episode;
          if (allEpisodes[episodeIdx]) {
            const episode = allEpisodes[episodeIdx];
            const episodeID = IDfromEpisode(episode);
            try { const url = await getVideoURL(episodeID); newVideoURLMap.set(episodeID, url); }
            catch (error) { }
          }
        } else if (selectionData.type === 'multi_trajectory') {
          for (const stateData of selectionData.data as any[]) {
            // Handle both old number format and new object format
            const episodeIdx = typeof stateData === 'number' ? stateData : stateData.episode;
            if (typeof episodeIdx === 'number' && allEpisodes[episodeIdx]) {
              const episode = allEpisodes[episodeIdx];
              const episodeID = IDfromEpisode(episode);
              try { const url = await getVideoURL(episodeID); newVideoURLMap.set(episodeID, url); }
              catch (error) { }
            }
          }
        }
        setVideoURLs(newVideoURLMap);
        setLoading(false);
      };
      fetchVideos();
    } else if (selectionData.type === 'user_demo') {
      const data = (selectionData as any).data || {};
      const trajectory: UserDemoTrajectory | null = data?.trajectory ?? null;
      const trajectoryId: string | undefined = data?.trajectoryId;
      const rawVideoPath: string | undefined = data?.raw?.videoPath;
      const map = new Map<string, string>();
      const storageId = trajectory?.id ?? trajectoryId;
      const videoPath = trajectory?.videoPath ?? rawVideoPath;
      if (storageId && videoPath) {
        const resolved = resolveDemoPath(videoPath);
        if (resolved) {
          map.set(storageId, resolved);
        }
      }
      setVideoURLs(map);
      setLoading(false);
    }
  }, [selectionData, allEpisodes, getVideoURL, resolveDemoPath]);

  // Fetch cluster frame images when cluster is selected
  useEffect(() => {
    if (selectionData.type === 'cluster' && selectionData.data && selectionData.data.length > 0) {
      setSelectionInstance(prev => prev + 1); // Increment selection instance for unique keys
      const episodeIndices = (activeLearningState as any).episodeIndices;
      if (!episodeIndices || episodeIndices.length === 0) { setClusterFrameImages([]); return; }
      if (!allEpisodes || allEpisodes.length === 0) { setClusterFrameImages([]); return; }
      let clusterIndices: number[] = selectionData.data as number[];
      if (clusterIndices.length === 0) return;
      if (clusterIndices.length > 12) clusterIndices = d3.shuffle(clusterIndices).slice(0, 12);
      const episodeStepPairs = clusterIndices
        .map((stateIndex: number) => {
          const episodeNumber = episodeIndices[stateIndex];
          if (episodeNumber === undefined) return null;
          const episode = allEpisodes[episodeNumber];
          if (!episode) return null;
          const episodeStart = episodeIndices.indexOf(episodeNumber);
          const stepWithinEpisode = stateIndex - episodeStart;
          return { stateIndex, episodeNumber, stepWithinEpisode, episode: { env_name: episode.env_name, benchmark_id: episode.benchmark_id, checkpoint_step: episode.checkpoint_step, episode_num: episode.episode_num } };
        })
        .filter(Boolean) as any[];
      if (episodeStepPairs.length > 0) {
        const episodeData = episodeStepPairs.map((pair) => pair.episode);
        const stepIndices = episodeStepPairs.map((pair) => pair.stepWithinEpisode);
        fetchClusterFrames(stepIndices, episodeData);
      }
    } else { setClusterFrameImages([]); }
  }, [selectionData, allEpisodes, fetchClusterFrames, (activeLearningState as any).episodeIndices]);

  useEffect(() => {
  videoRefs.current.forEach((video, index) => {
    if (video) {
      if (currentPlaying === index) {
        video.play().catch((e) => {
          console.log(`Failed to play video ${index}:`, e);
        });
      } else {
        video.pause();
      }
    }
  });
}, [currentPlaying]);

  // Generate proper target based on selection type
  const createTarget = (selectionType: string, data: any, step?: number) => {
    switch (selectionType) {
      case 'trajectory': {
        const episode = allEpisodes[data];
        const episodeId = IDfromEpisode(episode);
        return { target_id: episodeId, reference: episode, origin: 'online', timestamp: Date.now() };
      }
      case 'state':
        return { target_id: `state_${data[0]}_${data[1]}`, reference: null, origin: 'online', timestamp: Date.now(), step };
      case 'cluster':
        return { target_id: `cluster_${data}`, reference: null, origin: 'online', timestamp: Date.now() };
      case 'coordinate':
        return { target_id: `coordinate_${data.x}_${data.y}`, reference: null, origin: 'online', timestamp: Date.now() };
      case 'user_demo': {
        const trajectoryId = data?.trajectory?.id ?? data?.trajectoryId ?? Date.now();
        const target: any = {
          target_id: `user_demo_${trajectoryId}`,
          reference: null,
          origin: 'online',
          timestamp: Date.now(),
        };
        if (typeof data?.pointIndex === 'number' && Number.isFinite(data.pointIndex)) {
          target.step = data.pointIndex;
        }
        return target;
      }
      default:
        return { target_id: `unknown_${Date.now()}`, reference: null, origin: 'online', timestamp: Date.now() };
    }
  };

  const getEpisodeNumberFromIndex = (episodeIdx: number | undefined): number | undefined => {
    if (episodeIdx === undefined || episodeIdx === null) return undefined;
    const episodeRecord = allEpisodes?.[episodeIdx];
    if (episodeRecord && typeof episodeRecord.episode_num === 'number') {
      return episodeRecord.episode_num;
    }
    return typeof episodeIdx === 'number' ? episodeIdx : undefined;
  };

  const summarizeSelectionForHistory = (category: string): any => {
    switch (selectionData.type) {
      case 'state': {
        const state = selectionData.data?.[0];
        if (state === undefined || state === null) break;
        const episodeIdx = typeof state === 'number' ? state : state.episode;
        const episodeNum = getEpisodeNumberFromIndex(episodeIdx);
        const step = typeof state === 'object' && state !== null ? state.step : undefined;
        const summary: Record<string, unknown> = {};
        if (typeof episodeNum === 'number') summary.episode = episodeNum;
        if (typeof step === 'number') summary.step = step;
        if (!Object.keys(summary).length) summary.description = `${category} feedback`;
        return summary;
      }
      case 'multi_trajectory': {
        const episodes = (selectionData.data || [])
          .map((item: any) => getEpisodeNumberFromIndex(typeof item === 'number' ? item : item?.episode))
          .filter((ep: any): ep is number => typeof ep === 'number');
        if (episodes.length >= 2) {
          return { episodes: Array.from(new Set(episodes)).slice(0, 4) };
        }
        if (episodes.length === 1) {
          return { episode: episodes[0] };
        }
        break;
      }
      case 'cluster': {
        const label = selectionData.label ?? 'Cluster';
        const size = selectionData.data?.length ?? 0;
        return { cluster_id: label, description: `${label} (${size} states)` };
      }
      case 'coordinate': {
        const coord = selectionData.data?.[0];
        if (coord && coord.x !== undefined && coord.y !== undefined) {
          const x = Number(coord.x);
          const y = Number(coord.y);
          if (Number.isFinite(x) && Number.isFinite(y)) {
            return { description: `Coordinate (${x.toFixed(2)}, ${y.toFixed(2)})` };
          }
        }
        break;
      }
      case 'user_demo': {
        const data = (selectionData as any).data || {};
        const trajectory: UserDemoTrajectory | null = data?.trajectory ?? null;
        const source = trajectory?.metadata?.source ?? 'demo';
        const summary: Record<string, unknown> = { description: `Demonstration (${source})` };
        if (typeof data?.pointIndex === 'number' && Number.isFinite(data.pointIndex)) {
          summary.step = data.pointIndex;
        }
        return summary;
      }
      default:
        break;
    }

    if (selection && selection.length > 0) {
      return { description: `${category} feedback` };
    }

    return { description: 'Feedback' };
  };

  const buildFeedbackHistoryEntry = (fb: Feedback, category: string): FeedbackHistoryEntry | null => {
    const timestamp = fb.timestamp ?? Date.now();
    const entry: FeedbackHistoryEntry = {
      id: `${timestamp}_${Math.random().toString(36).slice(2, 8)}`,
      type: category,
      target: summarizeSelectionForHistory(category),
      uncertaintyEffect: DEFAULT_UNCERTAINTY_EFFECTS[category] ?? 0,
      timestamp,
      phase: activeLearningState.currentPhase,
    };

    if (fb.feedback_type === FeedbackType.Comparative && fb.targets?.length) {
      const episodes = fb.targets
        .map((target) => {
          const reference = target.reference as any;
          if (reference && typeof reference.episode_num === 'number') {
            return reference.episode_num;
          }
          if (typeof target.target_id === 'string') {
            return target.target_id;
          }
          return undefined;
        })
        .filter((val) => val !== undefined);
      if (episodes.length >= 2) {
        entry.target = { episodes: episodes.slice(0, 4) };
      }
    } else if (fb.granularity === 'segment' && fb.targets?.length) {
      const segment = fb.targets[0] as any;
      const episodeNum = getEpisodeNumberFromIndex(segment?.reference?.episode);
      if (typeof episodeNum === 'number' && segment?.start !== undefined && segment?.end !== undefined) {
        entry.target = {
          episode: episodeNum,
          description: `Episode ${episodeNum} (steps ${segment.start}-${segment.end})`,
        };
      }
    } else if (fb.feedback_type === FeedbackType.Corrective && fb.targets?.length) {
      const firstTarget = fb.targets[0] as any;
      const episodeIdx = firstTarget?.reference?.episode ?? firstTarget?.episode;
      const episodeNum = getEpisodeNumberFromIndex(episodeIdx);
      const step = firstTarget?.step;
      entry.target = {
        episode: episodeNum,
        step: typeof step === 'number' ? step : undefined,
        description:
          typeof episodeNum === 'number' && typeof step === 'number'
            ? `Episode ${episodeNum}, Step ${step}`
            : `${category} feedback`,
      };
    }

    return entry;
  };

  // Submit feedback to the system
  const submitFeedback = async (fb: Feedback) => {
    appDispatch({ type: 'SCHEDULE_FEEDBACK', payload: fb });
    try { await axios.post('/data/give_feedback', [fb]); } catch (error) { }
    const category = getFeedbackCategory(
      fb.feedback_type,
      fb.feedback_type === FeedbackType.Evaluative ? (selectionData as any).type : undefined
    );
    activeLearningDispatch({ type: 'UPDATE_FEEDBACK_COUNT', payload: { category, isCurrentSession: true } });

    const historyEntry = buildFeedbackHistoryEntry(fb, category);
    if (historyEntry) {
      activeLearningDispatch({ type: 'ADD_FEEDBACK_HISTORY_ENTRY', payload: historyEntry });
    }
    setSubmitted(true);
    triggerStepComplete('provide-feedback');

    // Record highlights for the current selection so we can mark them in the projection
    try {
      const epIdxArr: number[] = [];
      const stateIdxArr: number[] = [];
      const coordKeys: string[] = [];
      const clusterSigs: string[] = [];

      const episodeIndices = (activeLearningState as any).episodeIndices || [];
      const sel = selection || [];
      const isEpisodeRating = fb.feedback_type === FeedbackType.Evaluative && (fb as any).granularity === 'episode';
      const isClusterRating = fb.feedback_type === FeedbackType.Evaluative && (fb as any).granularity === 'segment';
      const isCorrective = fb.feedback_type === FeedbackType.Corrective || (fb as any).granularity === 'state';
      for (const item of sel as any[]) {
        if (!item) continue;
        if (item.type === 'state' && item.data) {
          const ep = item.data.episode;
          const step = item.data.step;
          const idx = (typeof item.data.index === 'number') ? item.data.index : (() => {
            const start = episodeIndices.indexOf(ep);
            return start >= 0 && typeof step === 'number' ? start + step : -1;
          })();
          if (typeof ep === 'number') epIdxArr.push(ep);
          // Only mark the specific state for corrective/state-level feedback
          if (!isEpisodeRating && (isCorrective) && idx >= 0) stateIdxArr.push(idx);
        } else if (item.type === 'trajectory') {
          const ep = typeof item.data === 'number' ? item.data : null;
          if (typeof ep === 'number') epIdxArr.push(ep);
        } else if (item.type === 'cluster') {
          const indices: number[] = (item.data || []) as number[];
          // For cluster ratings, store a stable signature and avoid per-point rings
          if (isClusterRating) {
            const sig = JSON.stringify(Array.from(new Set(indices)).sort((a,b) => a - b).slice(0, 200));
            clusterSigs.push(sig);
          } else {
            // Otherwise, fallback to marking states
            stateIdxArr.push(...indices);
          }
        } else if (item.type === 'coordinate' && item.data) {
          const x = Number(item.data.x);
          const y = Number(item.data.y);
          if (!Number.isNaN(x) && !Number.isNaN(y)) {
            coordKeys.push(`${x.toFixed(3)},${y.toFixed(3)}`);
          }
        }
      }

      // Deduplicate arrays
      const uniqueEpisodes = Array.from(new Set(epIdxArr));
      const uniqueStates = Array.from(new Set(stateIdxArr));
      const uniqueCoords = Array.from(new Set(coordKeys));

      activeLearningDispatch({
        type: 'ADD_FEEDBACK_HIGHLIGHTS',
        payload: {
          episodes: uniqueEpisodes,
          states: uniqueStates,
          coordinates: uniqueCoords,
          clustersSignatures: Array.from(new Set(clusterSigs)),
          correctionEpisodes: isCorrective ? uniqueEpisodes : undefined,
        },
      });
    } catch (e) {
      // no-op
    }
    setTimeout(() => activeLearningDispatch({ type: 'SET_SELECTION', payload: [] }), 750);
  };

  // Handle rating submission
  const handleRate = () => {
    const stateData: any = (selectionData as any).data[0];
    const episodeIdx: number = typeof stateData === 'number' ? stateData : stateData.episode;
    const episode = allEpisodes[episodeIdx];
    if (!episode) return;
    const episodeID = IDfromEpisode(episode);
    const fb: Feedback = {
      feedback_type: FeedbackType.Evaluative,
      targets: [{ target_id: episodeID, reference: episode, origin: 'online', timestamp: Date.now() }],
      granularity: 'episode',
      timestamp: Date.now(),
      session_id: appState.sessionId,
      score: value,
    };
    submitFeedback(fb);
  };

  // Build episode segments from cluster indices and submit evaluative segment feedback
  const buildEpisodeSegmentsFromCluster = (clusterIndices: number[]) => {
    const episodeIndices = (activeLearningState as any).episodeIndices || [];
    const byEpisode: Map<number, number[]> = new Map();

    // Map global indices to per-episode step indices
    for (const gi of clusterIndices) {
      const ep = episodeIndices[gi];
      if (ep === undefined || ep === null) continue;
      const episodeStart = episodeIndices.indexOf(ep);
      if (episodeStart === -1) continue;
      const step = gi - episodeStart;
      if (!byEpisode.has(ep)) byEpisode.set(ep, []);
      byEpisode.get(ep)!.push(step);
    }

    // Collapse consecutive steps into [start,end] segments per episode
    const segments: { episodeIdx: number; ranges: { start: number; end: number }[] }[] = [];
    for (const [ep, steps] of byEpisode.entries()) {
      if (!steps.length) continue;
      const sorted = Array.from(new Set(steps)).sort((a, b) => a - b);
      const ranges: { start: number; end: number }[] = [];
      let start = sorted[0];
      let prev = sorted[0];
      for (let i = 1; i < sorted.length; i++) {
        const s = sorted[i];
        if (s === prev + 1) {
          prev = s;
        } else {
          ranges.push({ start, end: prev });
          start = s;
          prev = s;
        }
      }
      ranges.push({ start, end: prev });
      segments.push({ episodeIdx: ep, ranges });
    }

    return segments;
  };

  const handleClusterRate = () => {
    const clusterLabel = (selectionData as any).label;
    const clusterIndices: number[] = (selectionData as any).data || [];
    if (!clusterIndices.length) return;

    const episodeSegments = buildEpisodeSegmentsFromCluster(clusterIndices);
    if (!episodeSegments.length) return;

    // Build segment targets per episode
    const targets = episodeSegments.flatMap(({ episodeIdx, ranges }) => {
      const episode = allEpisodes[episodeIdx];
      if (!episode) return [] as any[];
      const episodeID = IDfromEpisode(episode);
      return ranges.map(({ start, end }) => ({
        target_id: episodeID,
        reference: episode,
        origin: 'online',
        timestamp: Date.now(),
        start,
        end,
      }));
    });

    console.log('Submitting cluster rating feedback for segments:', episodeSegments, targets);

    if (!targets.length) return;

    const fb: Feedback = {
      feedback_type: FeedbackType.ClusterRating,
      targets,
      granularity: 'segment',
      timestamp: Date.now(),
      session_id: appState.sessionId,
      score: value,
      cluster_label: clusterLabel,
    } as any;

    submitFeedback(fb);
  };

  // Handle comparison submission
  const handleComparison = () => {
    const targets = (selectionData as any).data.map((stateData: any) => {
      // Extract episode index from the state data object
      const episodeIdx = typeof stateData === 'number' ? stateData : stateData.episode;
      return createTarget('trajectory', episodeIdx);
    });
    const fb: Feedback = {
      feedback_type: FeedbackType.Comparative,
      targets,
      preferences: targets.map((target) => target.target_id === chosenId ? 1 : 0),
      granularity: 'episode',
      timestamp: Date.now(),
      session_id: appState.sessionId,
    };
    submitFeedback(fb);
  };

  const saveDemoAndIntegrate = useCallback(async (
    sessionId: string,
    source: 'generated' | 'correction',
    extraMetadata: Record<string, any> = {}
  ): Promise<UserDemoTrajectory | null> => {
    setSavingDemo(true);
    try {
      const payload: any = {
        session_id: sessionId,
        projection_method: activeLearningState.embeddingMethod,
      };
      if (appState.selectedCheckpoint !== undefined && appState.selectedCheckpoint !== null) {
        payload.checkpoint = Number(appState.selectedCheckpoint);
      }

      const response = await axios.post('/demo_generation/save_webrtc_demo', payload);
      const data = response.data;

      if (data?.success && data.artifacts) {
        const artifacts = data.artifacts;
        const demoFilePath = artifacts.demo_file ?? data.file_path ?? null;
        const palette = ['#FF6B35', '#FFB703', '#8338EC', '#3A86FF', '#219EBC'];
        const color = palette[(activeLearningState.userGeneratedTrajectories.length) % palette.length];
        const trajectory: UserDemoTrajectory = {
          id: `${sessionId}-${Date.now()}`,
          projection: (artifacts.projection ?? []).map((pt: number[]) => [...pt]),
          episodeIndices: artifacts.episode_indices ?? [],
          rewards: artifacts.rewards ?? [],
          dones: artifacts.dones ?? [],
          videoPath: artifacts.video_path ?? null,
          metadata: { ...(artifacts.metadata ?? {}), source, color, ...extraMetadata },
          demoFile: demoFilePath,
          projectionFile: artifacts.projection_file ?? null,
          totalReward: artifacts.total_reward,
          source,
        };
        activeLearningDispatch({ type: 'ADD_USER_GENERATED_TRAJECTORY', payload: trajectory });

        void (async () => {
          try {
            const videoReady = await waitForVideoAvailability(trajectory.videoPath);
            if (videoReady) {
              activeLearningDispatch({
                type: 'SET_SELECTION',
                payload: [{ type: 'user_demo', data: { trajectoryId: trajectory.id } }],
              });
            } else {
              console.warn('Demo video not ready yet; skipping immediate preview.');
            }
          } catch (checkError) {
            console.warn('Unable to verify demo video availability before preview.', checkError);
          }
        })();
        return trajectory;
      }

      console.error(data?.message || 'Failed to save demo data');
      return null;
    } catch (error) {
      console.error('Error saving demo data:', error);
      return null;
    } finally {
      setSavingDemo(false);
    }
  }, [activeLearningDispatch, activeLearningState.embeddingMethod, activeLearningState.userGeneratedTrajectories.length, appState.selectedCheckpoint, waitForVideoAvailability]);

  const submitDemo = async (extraMetadata: Record<string, any> = {}) => {
    const trajectory = await saveDemoAndIntegrate(appState.sessionId, 'generated', extraMetadata);
    const demoEpisode: Episode = {
      env_name: appState.selectedExperiment.env_id,
      benchmark_type: 'generated',
      benchmark_id: -1,
      checkpoint_step: -1,
      episode_num: Date.now(),
    } as any;
    const fb: Feedback = {
      feedback_type: FeedbackType.Demonstrative,
      targets: [{ target_id: IDfromEpisode(demoEpisode), reference: demoEpisode, origin: 'online', timestamp: Date.now() }],
      granularity: 'episode',
      timestamp: Date.now(),
      session_id: appState.sessionId,
      demonstration_path: trajectory?.demoFile ?? null,
    } as any;
    submitFeedback(fb);
  };

  // Get color for an episode based on its index
  const getEpisodeColor = useCallback(
    (episodeIdx: any) => {
      const color = getEpisodeColorFromUtil(episodeIdx, (activeLearningState as any).trajectoryColors, false);
      if (color !== '#888888') return color;
      if (episodeIdx === -1) return '#888888';
      return d3.interpolateCool(episodeIdx / Math.max(1, allEpisodes.length - 1));
    },
    [activeLearningState, allEpisodes.length]
  );

  const attachVideoRef = (index: number) => (el: HTMLVideoElement | null) => {
  videoRefs.current[index] = el;
  };

  const attachUserDemoVideoRef = useCallback((video: HTMLVideoElement | null) => {
    userDemoVideoRef.current = video;
  }, []);

  useEffect(() => {
    const cleanupFns: Array<() => void> = [];

    videoRefs.current.forEach((video, index) => {
      if (!video) return;

      const stateData = selectionData.type === 'state' ? selectionData.data[0] : null;
      const episodeIdx = typeof stateData === 'number' ? stateData : stateData?.episode;

      // Only sync if this is the selected episode
      if (episodeIdx !== index) {
        if (currentPlaying !== index) {
          try { video.pause(); } catch { /* noop */ }
        }
        return;
      }

      const episodeLength = Math.max(1, getEpisodeLength(index));
      const clampedStep = Math.max(0, Math.min(selectedStep, episodeLength - 1));

      const syncVideoTime = () => {
        const duration = video.duration;
        if (!Number.isFinite(duration) || duration <= 0) return;
        const denominator = Math.max(episodeLength - 1, 1);
        const targetTime = denominator > 0 ? (clampedStep / denominator) * duration : 0;
        if (!Number.isFinite(targetTime)) return;
        if (Math.abs(video.currentTime - targetTime) > 0.1) {
          video.currentTime = targetTime;
        }
      };

      if (video.readyState >= 1 && Number.isFinite(video.duration) && video.duration > 0) {
        syncVideoTime();
      } else {
        const handleLoadedMetadata = () => {
          syncVideoTime();
        };
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        cleanupFns.push(() => {
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        });
      }

      // Handle play/pause
      if (currentPlaying === index) {
        video.play().catch((e) => console.log('Play failed:', e));
      } else {
        try { video.pause(); } catch { /* noop */ }
      }
    });

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, [currentPlaying, selectedStep, selectionData, getEpisodeLength]);

  const getVideoElement = (
    episode: Episode,
    index: number,
    small = false,
    singleTrajectory = false,
    stepInVideo?: number,
    totalSteps?: number
  ) => {
    const episodeId = IDfromEpisode(episode);
    const videoUrl = videoURLs.get(episodeId);

    return (
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          border: `3px solid ${getEpisodeColor(index)}`,
          borderRadius: 2,
          overflow: 'hidden',
          aspectRatio: '16/9',
          mx: 'auto',
          boxShadow: currentPlaying === index ? '0 0 0 4px rgba(76, 175, 80, 0.25) inset' : 'none',
          transition: 'box-shadow 0.2s ease',
        }}
      >
        {videoUrl ? (
          <>
<video
  src={videoUrl}
  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
  muted
  ref={attachVideoRef(index)}
  onTimeUpdate={(e) => {
    if (!singleTrajectory || currentPlaying !== index) return;
    
    const video = e.currentTarget;
    const duration = video.duration;
    if (!duration || duration <= 0) return;
    
    const episodeLength = totalSteps || getEpisodeLength(index);
    const newStep = Math.floor((video.currentTime / duration) * episodeLength);
    
    if (newStep !== selectedStep) {
      startTransition(() => {
        setSelectedStep(newStep);
        // Update selection if needed
        if (selectionData.type === 'state') {
          activeLearningDispatch({
            type: 'SET_SELECTION',
            payload: [{
              type: 'state',
              data: {
                episode: index,
                step: newStep,
                coords: currentStateData?.coords || [0, 0],
                x: currentStateData?.x || 0,
                y: currentStateData?.y || 0,
                index: (currentStateData?.index || 0) + (newStep - selectedStep),
              },
            }],
          });
        }
      });
    }
  }}
/>
            <IconButton
              size="small"
              sx={{
                position: 'absolute',
                bottom: 6,
                right: 6,
                backgroundColor: currentPlaying === index ? 'rgba(76, 175, 80, 0.85)' : 'rgba(0,0,0,0.5)',
                color: 'white',
                '&:hover': {
                  backgroundColor: currentPlaying === index ? 'rgba(76, 175, 80, 0.95)' : 'rgba(0,0,0,0.7)',
                },
                p: 0.5,
              }}
              onClick={() => {
                const videoEl = videoRefs.current[index];
                if (videoEl) {
                  if (currentPlaying === index) {
                    videoEl.pause();
                    setCurrentPlaying(null);
                  } else {
                    videoRefs.current.forEach((video, i) => { if (video && i !== index) video.pause(); });
                    videoEl.play().catch(() => { });
                    setCurrentPlaying(index);
                  }
                }
              }}
            >
              {currentPlaying === index ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
            </IconButton>
            {small && videoProgress.has(index) && (
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: 4,
                  bgcolor: 'rgba(255,255,255,0.25)'
                }}
              >
                <Box
                  sx={{
                    width: `${Math.max(0, Math.min(1, videoProgress.get(index) ?? 0)) * 100}%`,
                    height: '100%',
                    bgcolor: 'primary.main',
                    transition: 'width 0.15s linear'
                  }}
                />
              </Box>
            )}
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: 'action.hover' }}>
            {loading ? <CircularProgress size={24} /> : 'No video available'}
          </Box>
        )}
        <Box
          sx={{
            position: 'absolute',
            top: 6,
            left: 6,
            backgroundColor: getEpisodeColor(index),
            color: 'white',
            borderRadius: 1,
            px: 1,
            py: 0.25,
            fontSize: '0.7rem',
          }}
        >
          Episode {episode.episode_num}
        </Box>
      </Box>
    );
  };

  // Get title based on selection type
  const title = useMemo(() => {
    switch ((selectionData as any).type) {
      case 'none':
        return 'No Selection';
      case 'state':
        return 'Rate Entire Episode';
      case 'multi_trajectory':
        return 'Select the Best Episode';
      case 'cluster':
        return 'Rate this Cluster of States';
      case 'coordinate':
        return 'Demo from New Coordinate';
      case 'user_demo':
        return 'User Generated Demo';
      default:
        return 'Selection';
    }
  }, [selectionData]);

  // ————————————————————————————————————————————————————————————
  // Main render
  // ————————————————————————————————————————————————————————————
  const renderContent = () => {
    if (submitted) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
          <Alert severity="success" sx={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
            Feedback submitted successfully!
          </Alert>
        </Box>
      );
    }

    switch ((selectionData as any).type) {
      case 'none':
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.secondary" align="center">
              Select items from the visualization to provide feedback
            </Typography>
          </Box>
        );

      case 'multi_trajectory':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>{title}</Typography>
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={2}>
                {(selectionData as any).data.map((stateData: any, index: number) => {
                  // Handle both old number format and new object format
                  const episodeIdx = typeof stateData === 'number' ? stateData : stateData.episode;
                  if (typeof episodeIdx !== 'number') return null;
                  const episodeData = allEpisodes[episodeIdx];
                  if (!episodeData) return null;
                  const target = createTarget('trajectory', episodeIdx);
                  const id = (target as any).target_id;
                  return (
                    <Grid item xs={12} sm={6} key={id}>
                      <Paper
                        elevation={chosenId === id ? 3 : 0}
                        sx={{ p: 1.5, border: chosenId === id ? `2px solid ${getEpisodeColor(episodeIdx)}` : '1px solid', borderColor: 'divider', borderRadius: 2, height: '100%' }}
                      >
                        <Stack spacing={1.25}>
                          <Box>{getVideoElement(episodeData, episodeIdx, true)}</Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, borderRadius: 1, cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }} onClick={() => setChosenId(id)}>
                            <Radio checked={chosenId === id} onChange={() => setChosenId(id)} size="small" sx={{ p: 0.5 }} />
                            <Typography variant="body2" sx={{ ml: 0.5 }}>Episode {episodeIdx}</Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button variant="contained" onClick={handleComparison} disabled={!chosenId} size="small">Submit Selection</Button>
            </Box>
          </Box>
        );

      case 'user_demo': {
        const data = (selectionData as any).data || {};
        const trajectory: UserDemoTrajectory | null = data?.trajectory ?? null;
        const trajectoryId: string | undefined = trajectory?.id ?? data?.trajectoryId;
        const pointIndex =
          typeof data?.pointIndex === 'number' && Number.isFinite(data.pointIndex)
            ? data.pointIndex
            : null;

        if (!trajectory) {
          return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography variant="body2" color="text.secondary">Select a user-generated demo to preview.</Typography>
            </Box>
          );
        }

        const rawVideoPath: string | undefined = data?.raw?.videoPath;
        const resolvedVideoURL =
          (trajectoryId ? videoURLs.get(trajectoryId) : undefined) ||
          (trajectory?.videoPath ? resolveDemoPath(trajectory.videoPath) : null) ||
          (rawVideoPath ? resolveDemoPath(rawVideoPath) : null);

        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="h6">{title}</Typography>
            <Paper elevation={3} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {resolvedVideoURL ? (
                <>
                  <video
                    key={trajectoryId}
                    controls
                    style={{ width: '100%', borderRadius: 8, display: userDemoVideoStatus === 'error' ? 'none' : 'block' }}
                    src={resolvedVideoURL}
                    ref={attachUserDemoVideoRef}
                    onLoadStart={() => setUserDemoVideoStatus('loading')}
                    onCanPlay={() => setUserDemoVideoStatus('ready')}
                    onLoadedData={() => setUserDemoVideoStatus('ready')}
                    onError={() => setUserDemoVideoStatus('error')}
                  >
                    Your browser does not support the video tag.
                  </video>
                  {userDemoVideoStatus === 'loading' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                      <Stack spacing={1} alignItems="center">
                        <CircularProgress size={24} />
                        <Typography variant="body2" color="text.secondary">Preparing video preview…</Typography>
                      </Stack>
                    </Box>
                  )}
                  {userDemoVideoStatus === 'error' && (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 4, bgcolor: 'action.hover', borderRadius: 1 }}>
                      <Stack spacing={1} alignItems="center">
                        <Typography variant="body2" color="text.secondary" align="center">
                          Video is still processing. Please try again shortly.
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => {
                            setUserDemoVideoStatus('loading');
                            const video = userDemoVideoRef.current;
                            if (video) {
                              try { video.load(); } catch { /* noop */ }
                            }
                          }}
                        >
                          Retry
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, bgcolor: 'action.hover' }}>
                  {loading ? <CircularProgress size={24} /> : 'No video available'}
                </Box>
              )}
              <Stack spacing={0.5}>
                {trajectory.totalReward !== undefined && (
                  <Typography variant="body2">Total reward: {Number(trajectory.totalReward ?? 0).toFixed(2)}</Typography>
                )}
                {trajectory.metadata?.source && (
                  <Typography variant="body2" color="text.secondary">
                    Source: {trajectory.metadata.source}
                  </Typography>
                )}
                {pointIndex !== null && (
                  <Typography variant="body2" color="text.secondary">
                    Selected step: {pointIndex}
                  </Typography>
                )}
              </Stack>
              {resolvedVideoURL && (
                <Button
                  size="small"
                  variant="outlined"
                  href={resolvedVideoURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  disabled={userDemoVideoStatus !== 'ready'}
                >
                  Open Video in New Tab
                </Button>
              )}
            </Paper>
          </Box>
        );
      }

      case 'state': {
        const stateData: any = (selectionData as any).data[0];
        let episode: Episode; let episodeIdx: number; let episodeLength: number;
        if (typeof stateData === 'number') { episodeIdx = stateData; episode = allEpisodes[episodeIdx]; episodeLength = getEpisodeLength(episodeIdx); }
        else { episodeIdx = stateData.episode; episode = allEpisodes[episodeIdx]; episodeLength = getEpisodeLength(episodeIdx); }
        if (!episode) return <Typography color="error">Episode {episodeIdx} not found</Typography>;

        return (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ mb: 2 }}>{title}</Typography>

            {/* Video */}
            <Box sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: showCorrectionInterface && useWebRTCCorrection ? 'min(200px, 25vh)' : 'min(280px, 35vh)',
              mb: 2
            }}>
              <Box sx={{ width: '100%' }}>{getVideoElement(episode, episodeIdx, false, true, selectedStep, episodeLength)}</Box>
            </Box>

            {/* Timeline controls */}
            <Box sx={{ ...sectionCardSx, flexShrink: 0 }}>
              <Box sx={toolbarSx}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {currentPlaying === episodeIdx && (
                    <Box sx={{ display: 'flex', alignItems: 'center', backgroundColor: '#4CAF50', color: 'white', px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', gap: 0.5 }}>
                      <PlayArrow sx={{ fontSize: '0.875rem' }} /> Playing
                    </Box>
                  )}
                </Stack>
                <Button variant="outlined" size="small" onClick={() => setShowCorrectionInterface(!showCorrectionInterface)}>
                  <ModeEdit />
                  {showCorrectionInterface ? 'Show Rating' : 'Correct at Step'}
                </Button>
              </Box>

              <Box sx={{ mt: 1 }} ref={timelineContainerRef}>
                <TimelineComponent
                  selectedEpisode={episodeIdx}
                  selectedStep={selectedStep}
                  onClose={() => { /* inline usage: no-op */ }}
                  onStepSelect={showCorrectionInterface ? undefined : ((newStep) => {
                    const clamped = Math.max(0, Math.min(newStep, Math.max(0, episodeLength - 1)));
                    setSelectedStep(clamped);
                    const updatedSelection = [{
                      type: "state",
                      data: {
                        episode: episodeIdx,
                        step: clamped,
                        coords: currentStateData?.coords || [0, 0],
                        x: currentStateData?.x || 0,
                        y: currentStateData?.y || 0,
                        index: (currentStateData?.index || 0) + (clamped - selectedStep)
                      }
                    }];
                    activeLearningDispatch({ type: 'SET_SELECTION', payload: updatedSelection });
                  })}
                  width={Math.max(280, timelineWidth)}
                  height={140}
                  variant="inline"
                  showClose={false}
                />
                <Typography variant="caption" sx={{ display: 'block', mt: 0.5, textAlign: 'center', color: 'text.secondary' }}>
                  Step: {selectedStep} / {Math.max(0, episodeLength - 1)}
                </Typography>
              </Box>
            </Box>

            {/* Rating vs Correction */}
            {showCorrectionInterface ? (
              !useWebRTCCorrection ? (
                <Box sx={{ ...sectionCardSx, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Correct behavior at Step {selectedStep}</Typography>
                  <Button variant="contained" size="medium" onClick={() => setUseWebRTCCorrection(true)} disabled={loading}>Start Correction Demo</Button>
                </Box>
              ) : (
                <Box sx={{
                  ...sectionCardSx,
                  minHeight: 300,
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <WebRTCDemoComponent
                    sessionId={`${appState.sessionId}_correction`}
                    experimentId={appState.selectedExperiment.id.toString()}
                    environmentId={appState.selectedExperiment.env_id}
                    checkpoint={Number(appState.selectedCheckpoint)}
                    episodeNum={episode.episode_num}
                    step={selectedStep}
                    isSubmitting={savingDemo}
                    onSubmit={async () => {
                      const trajectory = await saveDemoAndIntegrate(`${appState.sessionId}_correction`, 'correction', {
                        episode: episode.episode_num,
                        step: selectedStep,
                      });
                      const fb: Feedback = {
                        feedback_type: FeedbackType.Corrective,
                        targets: [{ target_id: `state_${episode.episode_num}_${selectedStep}`, reference: null, origin: 'online', timestamp: Date.now(), step: selectedStep }],
                        granularity: 'state',
                        timestamp: Date.now(),
                        session_id: appState.sessionId,
                        correction: `Demo correction from episode ${episode.episode_num}, step ${selectedStep}`,
                        correction_path: trajectory?.demoFile ?? null,
                      } as any;
                      submitFeedback(fb);
                    }}
                    onCancel={() => { setUseWebRTCCorrection(false); setShowCorrectionInterface(false); }}
                  />
                </Box>
              )
            ) : (
              <Box sx={{ ...sectionCardSx, mt: 2 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, maxWidth: 560, mx: 'auto', width: '100%' }}>
                    <ThumbDown sx={{ cursor: 'pointer' }} fontSize="small" onClick={() => setValue((v) => Math.max(0, v - 1))} />
                    <Slider value={value} min={0} max={10} step={1} marks size="small" valueLabelDisplay="auto" onChange={(_, v) => setValue(v as number)} sx={evalSliderSx as any} />
                    <ThumbUp sx={{ cursor: 'pointer' }} fontSize="small" onClick={() => setValue((v) => Math.min(10, v + 1))} />
                    <Typography variant="body2" sx={{ minWidth: 36, textAlign: 'center' }}>{value}/10</Typography>
                  </Stack>
                  <Button variant="contained" size="small" onClick={handleRate}>Submit Rating</Button>
                </Stack>
              </Box>
            )}
          </Box>
        );
      }

      case 'cluster': {
        const clusterLabel = (selectionData as any).label;
        const clusterIndices: number[] = (selectionData as any).data;
        const maxStatesToShow = 12;
        const limitedIndices = clusterIndices.slice(0, maxStatesToShow);
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              Cluster {clusterLabel} Selected ({clusterIndices.length} states)
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Grid container spacing={2} sx={{ mb: 1 }}>
                {limitedIndices.map((i: number, index: number) => (
                  <Grid item xs={6} sm={4} md={3} key={`cluster-state-${selectionInstance}-${i}-${index}`}>
                    <Card sx={{ height: '100%' }}>
                      <CardContent>
                        {clusterFrameImages[index] ? (
                          <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper', borderRadius: 1, overflow: 'hidden' }}>
                            <img src={clusterFrameImages[index]} alt={`Cluster state ${i}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          </Box>
                        ) : (
                          <Box sx={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.paper', border: '1px dashed', borderColor: 'primary.main', borderRadius: 1 }}>
                            <ImageIcon sx={{ fontSize: 30, color: 'text.secondary' }} />
                          </Box>
                        )}
                        <Typography variant="caption" align="center" display="block">State #{i}</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
                {clusterIndices.length > maxStatesToShow && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">+ {clusterIndices.length - maxStatesToShow} more states not shown</Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
            <Box sx={{ ...sectionCardSx, mt: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, maxWidth: 560, mx: 'auto', width: '100%' }}>
                  <ThumbDown sx={{ cursor: 'pointer' }} onClick={() => setValue((v) => Math.max(0, v - 1))} />
                  <Slider value={value} min={0} max={10} step={1} marks valueLabelDisplay="auto" onChange={(_, v) => setValue(v as number)} sx={evalSliderSx as any} />
                  <ThumbUp sx={{ cursor: 'pointer' }} onClick={() => setValue((v) => Math.min(10, v + 1))} />
                  <Typography sx={{ minWidth: 36, textAlign: 'center' }}>{value}/10</Typography>
                </Stack>
                <Button variant="contained" onClick={handleClusterRate}>Submit Cluster Rating</Button>
              </Stack>
              <Typography variant="caption" display="block" sx={{ mt: 1, textAlign: 'center' }}>
                Rating applies to all {clusterIndices.length} states in the cluster
              </Typography>
            </Box>
          </Box>
        );
      }

      case 'coordinate': {
        const coordinate = (selectionData as any).data[0];
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom fontSize="0.95rem">Generate Demo from New State</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Box sx={{
                width: '100%',
                maxWidth: useWebRTC ? 'min(320px, 50vw)' : 'min(420px, 60vw)',
                aspectRatio: '16/9',
                backgroundColor: 'rgba(0,0,0,0.05)',
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative',
                border: '3px solid #FF6B35',
                mx: 'auto'
              }}>
                {coordinateFrameImage ? (
                  <img src={coordinateFrameImage} alt={`Predicted state frame for coordinate [${coordinate.x.toFixed(2)}, ${coordinate.y.toFixed(2)}]`} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', bgcolor: 'rgba(0,0,0,0.05)' }}>
                    {loading ? <CircularProgress size={24} /> : <ImageIcon sx={{ fontSize: 60, color: 'text.secondary' }} />}
                  </Box>
                )}
                <Box sx={{ position: 'absolute', top: 6, left: 6, backgroundColor: '#FF6B35', color: 'white', borderRadius: 1, px: 1, py: 0.3, fontSize: '0.7rem' }}>Predicted State</Box>
              </Box>
            </Box>
            <Box sx={{
              minHeight: useWebRTC ? 300 : 60
            }}>
              {!useWebRTC ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1 }}>
                  <Button variant="contained" onClick={() => setUseWebRTC(true)} disabled={loading} size="small">Start Demo</Button>
                </Box>
              ) : (
                <WebRTCDemoComponent
                  sessionId={appState.sessionId}
                  experimentId={appState.selectedExperiment.id.toString()}
                  environmentId={appState.selectedExperiment.env_id}
                  coordinate={coordinate}
                  isSubmitting={savingDemo}
                  onSubmit={() => submitDemo({ coordinate })}
                  onCancel={() => setUseWebRTC(false)}
                />
              )}
            </Box>
          </Box>
        );
      }

      default:
        return <Typography>Unsupported selection type: {(selectionData as any).type}</Typography>;
    }
  };

  return (
    <OnboardingHighlight stepId="provide-feedback" pulse preserveLayout>
      <Box ref={containerRef} sx={shellSx}>
        {loading && (
          <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.6)', zIndex: 10 }}>
            <CircularProgress size={24} />
          </Box>
        )}
        {renderContent()}
      </Box>
    </OnboardingHighlight>
  );
};

export default MergedSelectionFeedback;
