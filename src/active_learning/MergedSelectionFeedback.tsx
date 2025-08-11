import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
  Divider,
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
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import * as d3 from 'd3';
import { IDfromEpisode } from '../id';
import { useGetter } from '../getter-context';
import { Episode, FeedbackType, Feedback } from '../types';
import { getEpisodeColor as getEpisodeColorFromUtil } from './utils/trajectoryColors';
import axios from 'axios';
import WebRTCDemoComponent from './WebRTCDemoComponent';
import { OnboardingHighlight, useOnboarding } from './OnboardingSystem';

// ————————————————————————————————————————————————————————————
// Visual helpers
// ————————————————————————————————————————————————————————————
const shellSx = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column' as const,
  p: 2,
  overflow: 'hidden',
  position: 'relative' as const,
  gap: 2,
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

const stickyActionBarSx = {
  position: 'sticky' as const,
  bottom: 0,
  p: 1.5,
  mt: 'auto',
  borderTop: '1px solid',
  borderColor: 'divider',
  backgroundColor: 'background.paper',
  zIndex: 2,
};

// ————————————————————————————————————————————————————————————
// Helper function to map feedback type to category
// ————————————————————————————————————————————————————————————
const getFeedbackCategory = (feedbackType: FeedbackType, selectionType?: string): string => {
  switch (feedbackType) {
    case FeedbackType.Evaluative:
      return selectionType === 'cluster' ? 'Cluster' : 'Rating';
    case FeedbackType.Comparative:
      return 'Comparison';
    case FeedbackType.Corrective:
      return 'Correction';
    case FeedbackType.Demonstrative:
      return 'Demo';
    default:
      return 'Rating';
  }
};

const MergedSelectionFeedback = () => {
  const appState = useAppState();
  const appDispatch = useAppDispatch();
  const activeLearningState = useActiveLearningState();
  const activeLearningDispatch = useActiveLearningDispatch();
  const { getVideoURL } = useGetter();
  const { triggerStepComplete } = useOnboarding();

  // State for videos and interaction
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [videoURLs, setVideoURLs] = useState<Map<string, string>>(new Map<string, string>());
  const [clusterFrameImages, setClusterFrameImages] = useState<string[]>([]);
  const [coordinateFrameImage, setCoordinateFrameImage] = useState<string | null>(null);

  // Feedback state
  const [value, setValue] = useState(5);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [useWebRTC, setUseWebRTC] = useState(false);
  const [useWebRTCCorrection, setUseWebRTCCorrection] = useState(false);
  const [currentPlaying, setCurrentPlaying] = useState<number | null>(null);
  const [selectedStep, setSelectedStep] = useState(0);
  const [showCorrectionInterface, setShowCorrectionInterface] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Use selection directly from state
  const selection = useMemo(() => activeLearningState.selection || [], [activeLearningState.selection]);
  const allEpisodes = useMemo(() => {
    const episodes = appState.episodeIDsChronologically || [];
    const selectedCheckpoint = appState.selectedCheckpoint;
    // Filter episodes to only include those from the current checkpoint
    return episodes.filter((episode: Episode) => 
      selectedCheckpoint && episode.checkpoint_step === Number(selectedCheckpoint)
    );
  }, [appState.episodeIDsChronologically, appState.selectedCheckpoint]);
  // Extract selection type and data
  const selectionData = useMemo(() => {
    if (selection.length === 0) return { type: 'none', data: [] } as any;
    if (selection.length === 1) {
      const item: any = selection[0];
      if (item.type === 'cluster') return { type: 'cluster', label: (item as any).label, data: item.data } as any;
      if (item.type === 'coordinate') return { type: 'coordinate', data: [item.data] } as any;
      return { type: 'state', data: [item.data] } as any;
    }
    const allTrajectories = selection.every((item: any) => item.type === 'state');
    if (allTrajectories) return { type: 'multi_trajectory', data: selection.map((item: any) => item.data) } as any;
    return { type: 'mixed', data: selection } as any;
  }, [selection]);

  // Initialize videoRefs based on selection length
  useEffect(() => { videoRefs.current = Array(selection.length).fill(null); }, [selection.length]);

  // Reset feedback state when selection changes
  useEffect(() => {
    setValue(5);
    setChosenId(null);
    setSubmitted(false);
    setUseWebRTC(false);
    setUseWebRTCCorrection(false);
    setCoordinateFrameImage(null);
    setSelectedStep(0);
    setShowCorrectionInterface(false);
  }, [selection]);

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
    } else if (selectionData.type === 'trajectory' && selection.length === 2) {
      const stateSelection: any = (selection as any).find((item: any) => item.type === 'state');
      if (stateSelection && stateSelection.data?.step !== undefined) setSelectedStep(stateSelection.data.step);
      else setSelectedStep(0);
    } else {
      setSelectedStep(0);
    }
  }, [selectionData.type, currentStateData, currentStep, selection]);

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
    console.log(selectionData);
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
    }
  }, [selectionData, allEpisodes, getVideoURL]);

  // Fetch cluster frame images when cluster is selected
  useEffect(() => {
    if (selectionData.type === 'cluster' && selectionData.data && selectionData.data.length > 0) {
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
  }, [selectionData, allEpisodes, fetchClusterFrames, activeLearningState]);

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
      default:
        return { target_id: `unknown_${Date.now()}`, reference: null, origin: 'online', timestamp: Date.now() };
    }
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
    setSubmitted(true);
    triggerStepComplete('provide-feedback');
    setTimeout(() => activeLearningDispatch({ type: 'SET_SELECTION', payload: [] }), 1500);
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

  const submitDemo = () => {
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
    [allEpisodes.length, (activeLearningState as any).trajectoryColors]
  );

  // Get video element for an episode
  const getVideoElement = (
    episode: Episode,
    index: number,
    small = false,
    singleTrajectory = false,
    stepSync = false,
    currentStepTime = 0,
    totalSteps?: number
  ) => {
    const episodeId = IDfromEpisode(episode);
    const videoUrl = videoURLs.get(episodeId);
    const episodeLength = totalSteps || getEpisodeLength(index);
    const getMaxWidth = () => (singleTrajectory ? 'min(720px, 70vw)' : small ? '220px' : '320px');

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
          maxWidth: getMaxWidth(),
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
              autoPlay={currentPlaying === index && !stepSync}
              loop={currentPlaying === index && !stepSync}
              ref={(el) => {
                if (el) {
                  const syncVideoTime = () => {
                    if (stepSync) {
                      const videoTotalSteps = episodeLength;
                      const duration = el.duration;
                      if (duration && !isNaN(duration) && duration > 0) {
                        const targetTime = (currentStepTime / videoTotalSteps) * duration;
                        if (!isNaN(targetTime) && Math.abs(targetTime - el.currentTime) > 0.1) {
                          el.currentTime = targetTime;
                          el.pause();
                        }
                      }
                    } else if (currentPlaying === index) {
                      el.play().catch(() => { });
                    } else {
                      el.pause();
                    }
                  };
                  if (el.readyState >= 1) syncVideoTime();
                  else el.addEventListener('loadedmetadata', syncVideoTime, { once: true } as any);
                  videoRefs.current[index] = el;
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
        return 'Rate Episode';
      case 'multi_trajectory':
        return 'Select the Best Episode';
      case 'cluster':
        return 'Rate this Cluster of States';
      case 'coordinate':
        return 'Demo from New Coordinate';
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
        console.log("MT SELECTION DATA", selectionData, allEpisodes);
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <Typography variant="h6" gutterBottom>{title}</Typography>
            <Box sx={{ flex: 1, overflowY: 'auto', pb: 1, minHeight: 300 }}>
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
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 'auto', mb: 1 }}>
              <Button variant="contained" onClick={handleComparison} disabled={!chosenId} size="small">Submit Selection</Button>
            </Box>
          </Box>
        );

      case 'state': {
        const stateData: any = (selectionData as any).data[0];
        let episode: Episode; let episodeIdx: number; let episodeLength: number;
        if (typeof stateData === 'number') { episodeIdx = stateData; episode = allEpisodes[episodeIdx]; episodeLength = getEpisodeLength(episodeIdx); }
        else { episodeIdx = stateData.episode; episode = allEpisodes[episodeIdx]; episodeLength = getEpisodeLength(episodeIdx); }
        if (!episode) return <Typography color="error">Episode {episodeIdx} not found</Typography>;

        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <Typography variant="h6">{title}</Typography>

            {/* Video */}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'min(320px, 42vh)' }}>
              <Box sx={{ width: '100%' }}>{getVideoElement(episode, episodeIdx, false, true, true, selectedStep, episodeLength)}</Box>
            </Box>

            {/* Timeline controls */}
            <Box sx={sectionCardSx}>
              <Box sx={toolbarSx}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {currentPlaying === episodeIdx && (
                    <Box sx={{ display: 'flex', alignItems: 'center', backgroundColor: '#4CAF50', color: 'white', px: 1, py: 0.25, borderRadius: 1, fontSize: '0.75rem', gap: 0.5 }}>
                      <PlayArrow sx={{ fontSize: '0.875rem' }} /> Playing
                    </Box>
                  )}
                </Stack>
                <Button variant="outlined" size="small" onClick={() => setShowCorrectionInterface(!showCorrectionInterface)}>
                  <ModeEdit/>
                  {showCorrectionInterface ? 'Show Rating' : 'Correct at Step'}
                </Button>
              </Box>

              <Stack spacing={1.25} sx={{ mt: 1 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                  <Button size="small" variant="outlined" onClick={() => {
                    const newStep = Math.max(0, selectedStep - 1);
                    setSelectedStep(newStep);
                    // Update the selection to reflect the new step
                    const updatedSelection = [{
                      type: "state",
                      data: {
                        episode: episodeIdx,
                        step: newStep,
                        coords: currentStateData?.coords || [0, 0],
                        x: currentStateData?.x || 0,
                        y: currentStateData?.y || 0,
                        index: (currentStateData?.index || 0) - (selectedStep - newStep) // Adjust index based on step change
                      }
                    }];
                    activeLearningDispatch({
                      type: 'SET_SELECTION',
                      payload: updatedSelection
                    });
                  }} disabled={selectedStep <= 0}>← Prev</Button>
                  <Typography variant="body2" sx={{ minWidth: 120, textAlign: 'center' }}>Step: {selectedStep} / {Math.max(0, episodeLength - 1)}</Typography>
                  <Button size="small" variant="outlined" onClick={() => {
                    const newStep = Math.min(episodeLength - 1, selectedStep + 1);
                    setSelectedStep(newStep);
                    // Update the selection to reflect the new step
                    const updatedSelection = [{
                      type: "state",
                      data: {
                        episode: episodeIdx,
                        step: newStep,
                        coords: currentStateData?.coords || [0, 0],
                        x: currentStateData?.x || 0,
                        y: currentStateData?.y || 0,
                        index: (currentStateData?.index || 0) + (newStep - selectedStep) // Adjust index based on step change
                      }
                    }];
                    activeLearningDispatch({
                      type: 'SET_SELECTION',
                      payload: updatedSelection
                    });
                  }} disabled={selectedStep >= episodeLength - 1}>Next →</Button>
                </Stack>
                <Slider value={selectedStep} min={0} max={Math.max(0, episodeLength - 1)} step={1} size="small" valueLabelDisplay="auto" onChange={(_, v) => {
                  const newStep = v as number;
                  setSelectedStep(newStep);
                  // Update the selection to reflect the new step
                  const updatedSelection = [{
                    type: "state",
                    data: {
                      episode: episodeIdx,
                      step: newStep,
                      coords: currentStateData?.coords || [0, 0],
                      x: currentStateData?.x || 0,
                      y: currentStateData?.y || 0,
                      index: (currentStateData?.index || 0) + (newStep - selectedStep) // Adjust index based on step change
                    }
                  }];
                  activeLearningDispatch({
                    type: 'SET_SELECTION',
                    payload: updatedSelection
                  });
                }} sx={evalSliderSx as any} />
              </Stack>
            </Box>

            {/* Rating vs Correction */}
            {showCorrectionInterface ? (
              !useWebRTCCorrection ? (
                <Box sx={{ ...sectionCardSx, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Correct behavior at Step {selectedStep}</Typography>
                  <Button variant="contained" size="medium" onClick={() => setUseWebRTCCorrection(true)} disabled={loading}>Start Correction Demo</Button>
                </Box>
              ) : (
                <WebRTCDemoComponent
                  sessionId={`${appState.sessionId}_correction`}
                  experimentId={appState.selectedExperiment.id.toString()}
                  environmentId={appState.selectedExperiment.env_id}
                  checkpoint={Number(appState.selectedCheckpoint)}
                  episodeNum={episode.episode_num}
                  step={selectedStep}
                  onSubmit={() => {
                    const fb: Feedback = {
                      feedback_type: FeedbackType.Corrective,
                      targets: [{ target_id: `state_${episode.episode_num}_${selectedStep}`, reference: null, origin: 'online', timestamp: Date.now(), step: selectedStep }],
                      granularity: 'state',
                      timestamp: Date.now(),
                      session_id: appState.sessionId,
                      correction: `Demo correction from episode ${episode.episode_num}, step ${selectedStep}`,
                    } as any;
                    submitFeedback(fb);
                  }}
                  onCancel={() => { setUseWebRTCCorrection(false); setShowCorrectionInterface(false); }}
                />
              )
            ) : (
              <Box sx={stickyActionBarSx}>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Cluster {clusterLabel} Selected ({clusterIndices.length} states)
            </Typography>
            <Grid container spacing={2} sx={{ mb: 1 }}>
              {limitedIndices.map((i: number, index: number) => (
                <Grid item xs={6} sm={4} md={3} key={`cluster-state-${i}`}>
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
            <Box sx={stickyActionBarSx}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, maxWidth: 560, mx: 'auto', width: '100%' }}>
                  <ThumbDown sx={{ cursor: 'pointer' }} onClick={() => setValue((v) => Math.max(0, v - 1))} />
                  <Slider value={value} min={0} max={10} step={1} marks valueLabelDisplay="auto" onChange={(_, v) => setValue(v as number)} sx={evalSliderSx as any} />
                  <ThumbUp sx={{ cursor: 'pointer' }} onClick={() => setValue((v) => Math.min(10, v + 1))} />
                  <Typography sx={{ minWidth: 36, textAlign: 'center' }}>{value}/10</Typography>
                </Stack>
                <Button variant="contained" onClick={handleRate}>Submit Cluster Rating</Button>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom fontSize="0.95rem">Generate Demo from New State</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2, flex: '0 0 auto' }}>
              <Box sx={{ width: '100%', maxWidth: 'min(420px, 60vw)', aspectRatio: '16/9', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 2, overflow: 'hidden', position: 'relative', border: '3px solid #FF6B35', mx: 'auto' }}>
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
            <Box sx={{ flex: '1 1 auto' }}>
              {!useWebRTC ? (
                <Button variant="contained" onClick={() => setUseWebRTC(true)} disabled={loading} size="small" sx={{ mt: 1 }}>Start Demo</Button>
              ) : (
                <WebRTCDemoComponent
                  sessionId={appState.sessionId}
                  experimentId={appState.selectedExperiment.id.toString()}
                  environmentId={appState.selectedExperiment.env_id}
                  coordinate={coordinate}
                  onSubmit={submitDemo}
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
