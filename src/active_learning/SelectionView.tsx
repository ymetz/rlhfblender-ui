import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  IconButton,
  Paper,
  Chip,
} from '@mui/material';
import {
  DeleteOutline,
  VideoLibrary,
  Image as ImageIcon,
} from '@mui/icons-material';
import { useAppState } from '../AppStateContext';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import * as d3 from 'd3';
import { IDfromEpisode } from "../id";
import { useGetter } from "../getter-context";

const SelectionView = () => {
  const appState = useAppState();
  const activeLearningState = useActiveLearningState();
  const activeLearningDispatch = useActiveLearningDispatch();

  // State for currently playing video
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [videoURLs, setVideoURLs] = useState<Map<string, string>>(new Map<string, string>());

  // Get video URL from context
  const { getVideoURL } = useGetter();

  // Get selected items from state
  const selection = activeLearningState.selection || [];
  // Get all episodes for color calculation
  const allEpisodes = appState.episodeIDsChronologically || [];

  // Extract selection type and data
  const getSelectionData = () => {
    if (selection.length === 0) return { type: 'none', data: [] };
    if (selection.length === 1) {
      const item = selection[0];
      return { type: item.type, data: [item.data] };
    }
    // For multiple selections, check if all are trajectories
    const allTrajectories = selection.every(item => item.type === 'trajectory');
    if (allTrajectories) {
      return { type: 'multi_trajectory', data: selection.map(item => item.data) };
    }
    // Mixed types - handle later if needed
    return { type: 'mixed', data: selection };
  };

  const selectionData = getSelectionData();

  // Handle video playback
  const handlePlayPause = (index: number) => {
    if (currentVideoIndex === index) {
      if (isPlaying) {
        videoRefs.current[index]?.pause();
        setIsPlaying(false);
      } else {
        videoRefs.current[index]?.play();
        setIsPlaying(true);
      }
    } else {
      if (currentVideoIndex !== null && videoRefs.current[currentVideoIndex]) {
        videoRefs.current[currentVideoIndex]?.pause();
      }
      setCurrentVideoIndex(index);
      videoRefs.current[index]?.play();
      setIsPlaying(true);
    }
  };

  // Handle removing an episode from selection
  const removeFromSelection = (index: number) => {
    const newSelection = [...selection];
    newSelection.splice(index, 1);
    activeLearningDispatch({
      type: 'SET_SELECTION',
      payload: newSelection
    });

    // Reset video player if the current video is removed
    if (currentVideoIndex === index) {
      setCurrentVideoIndex(null);
      setIsPlaying(false);
    } else if (currentVideoIndex !== null && currentVideoIndex > index) {
      setCurrentVideoIndex(currentVideoIndex - 1);
    }
  };

  // Get color for an episode based on its index
  const getEpisodeColor = (episodeIdx: any) => {
    if (episodeIdx === -1) return '#888888';
    return d3.interpolateCool(episodeIdx / Math.max(1, allEpisodes.length - 1));
  };

  // Create a reference for a video element
  const setVideoRef = (el: HTMLVideoElement | null, index: number) => {
    videoRefs.current[index] = el;
  };

  // Render placeholder image for states
  const renderStatePlaceholder = () => (
    <Box
      sx={{
        height: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.paper',
        border: '1px dashed',
        borderColor: 'primary.main',
        borderRadius: 1,
      }}
    >
      <ImageIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
    </Box>
  );

  // Render based on selection type
  const renderSelection = () => {
    switch (selectionData.type) {
      case 'none':
        return (
          <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper' }}>
            <Typography variant="body1" color="text.secondary">
              No items selected. Use the + button to add items.
            </Typography>
          </Paper>
        );

      case 'trajectory':
      case 'multi_trajectory':
        const trajectories = selectionData.data;
        return (
          <Grid container spacing={2}>
            {trajectories.map((trajectoryIdx, index) => {
              const episodeColor = getEpisodeColor(trajectoryIdx);
              // TODO: Get actual episode data for trajectory
              const episode = allEpisodes[trajectoryIdx];
              const videoURL = episode ? videoURLs.get(IDfromEpisode(episode)) : null;

              return (
                <Grid item xs={12} sm={6} md={trajectories.length === 1 ? 12 : 4} key={index}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      border: `3px solid ${episodeColor}`,
                      position: 'relative'
                    }}
                  >
                    <Box
                      sx={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        zIndex: 1,
                        m: 1
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={() => removeFromSelection(index)}
                        sx={{ bgcolor: 'rgba(255,255,255,0.7)' }}
                      >
                        <DeleteOutline />
                      </IconButton>
                    </Box>

                    <CardActionArea onClick={() => handlePlayPause(index)}>
                      {videoURL ? (
                        <Box sx={{ height: 200, overflow: 'hidden' }}>
                          <video
                            ref={(el) => setVideoRef(el, index)}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                            muted
                          >
                            <source src={videoURL} type="video/mp4" />
                          </video>
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            height: 200,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            bgcolor: 'background.paper'
                          }}
                        >
                          <VideoLibrary sx={{ fontSize: 60, color: 'text.secondary' }} />
                        </Box>
                      )}
                    </CardActionArea>

                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ mt: 2 }}>
                        <Chip
                          label={`Trajectory ${trajectoryIdx}`}
                          size="small"
                          sx={{
                            bgcolor: episodeColor,
                            color: 'white',
                            mr: 1,
                            mb: 1
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        );

      case 'state':
        const state = selectionData.data[0];
        return (
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Single State Selected
              </Typography>
              {renderStatePlaceholder()}
              <Typography variant="body2" sx={{ mt: 2 }}>
                State coordinates: [{state[0].toFixed(2)}, {state[1].toFixed(2)}]
              </Typography>
            </CardContent>
          </Card>
        );

      case 'cluster':
        const clusterId: number = selectionData.data[0];
        // TODO: Get actual states in cluster
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Cluster {clusterId} Selected
            </Typography>
            <Grid container spacing={2}>
              {/* Placeholder for cluster states */}
              {[1, 2, 3, 4].map((i) => (
                <Grid item xs={6} key={i}>
                  <Card>
                    <CardContent>
                      {renderStatePlaceholder()}
                      <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>
                        State {i} in Cluster {clusterId}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        );

      case 'coordinate':
        const coordinate = selectionData.data[0];
        return (
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                New Coordinate Selected
              </Typography>
              {renderStatePlaceholder()}
              <Typography variant="body2" sx={{ mt: 2 }}>
                Coordinates: [{coordinate.x.toFixed(2)}, {coordinate.y.toFixed(2)}]
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Demo generation will start from this coordinate
              </Typography>
            </CardContent>
          </Card>
        );

      default:
        return (
          <Typography variant="body1" color="text.secondary">
            Unsupported selection type: {selectionData.type}
          </Typography>
        );
    }
  };

  // Update title based on selection type
  const getTitle = () => {
    switch (selectionData.type) {
      case 'none':
        return 'No Selection';
      case 'trajectory':
        return 'Selected Trajectory';
      case 'multi_trajectory':
        return `Selected Trajectories (${selectionData.data.length})`;
      case 'state':
        return 'Selected State';
      case 'cluster':
        return 'Selected Cluster';
      case 'coordinate':
        return 'Selected Coordinate';
      default:
        return 'Selection';
    }
  };

  // Load video URLs for trajectories if needed
  useEffect(() => {
    if (selectionData.type === 'trajectory' || selectionData.type === 'multi_trajectory') {
      const fetchVideoURLs = async () => {
        const videoURLmap = new Map<string, string>();
        const trajectoryEpisodes = selectionData.data
          .map(trajectoryIdx => allEpisodes[trajectoryIdx])
          .filter(Boolean);

        const urls = await Promise.all(
          trajectoryEpisodes.map(async (episode) => {
            const episodeID = IDfromEpisode(episode);
            if (!videoURLmap.has(episodeID)) {
              const url = await getVideoURL(episodeID);
              videoURLmap.set(episodeID, url);
            }
            return videoURLmap.get(episodeID) || '';
          })
        );
        setVideoURLs(videoURLmap);
      };
      fetchVideoURLs();
    }
  }, [selectionData, allEpisodes, getVideoURL]);

  return (
    <Box sx={{ padding: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        {getTitle()}
      </Typography>
      {renderSelection()}
    </Box>
  );
};

export default SelectionView;