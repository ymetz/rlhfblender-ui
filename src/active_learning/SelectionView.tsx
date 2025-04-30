import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
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
import { Episode } from '../types';

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

  // Use selection directly from state (no useRef for selection in this version)
  const selection = activeLearningState.selection || [];
  
  // Get all episodes for color calculation
  const allEpisodes = useMemo(() => appState.episodeIDsChronologically || [], [appState.episodeIDsChronologically]);

  // Extract selection type and data - using useMemo to prevent recalculations
  const selectionData = useMemo(() => {
    if (selection.length === 0) return { type: 'none', data: [] };
    if (selection.length === 1) {
      const item = selection[0];
      if (item.type === 'cluster')
        return { type: 'cluster', label: item.label, data: item.data };
      return { type: item.type, data: [item.data] };
    }
    // For multiple selections, check if all are trajectories
    const allTrajectories = selection.every(item => item.type === 'trajectory');
    if (allTrajectories) {
      return { type: 'multi_trajectory', data: selection.map(item => item.data) };
    }
    // Mixed types - handle later if needed
    return { type: 'mixed', data: selection };
  }, [selection]);

  // Initialize videoRefs based on selection length
  useEffect(() => {
    videoRefs.current = Array(selection.length).fill(null);
  }, [selection.length]);

  // Fetch video URLs for trajectories
  useEffect(() => {
    if (selection.length === 0) return;
    
    const trajectories = selection.filter(item => item.type === "trajectory");
    if (trajectories.length === 0) return;
    
    let isMounted = true;
    
    const fetchVideoURLs = async () => {
      try {
        const newVideoURLMap = new Map<string, string>(videoURLs);
        let urlsChanged = false;

        for (const elem of trajectories) {
          const theEpisode: Episode = allEpisodes[elem.data];
          if (!theEpisode) continue;
          
          const episodeID = IDfromEpisode(theEpisode);
          if (!newVideoURLMap.has(episodeID)) {
            const url = await getVideoURL(episodeID);
            newVideoURLMap.set(episodeID, url);
            urlsChanged = true;
          }
        }

        // Only update state if URLs actually changed and component is still mounted
        if (urlsChanged && isMounted) {
          setVideoURLs(newVideoURLMap);
        }
      } catch (error) {
        console.error("Error fetching video URLs:", error);
      }
    };

    fetchVideoURLs();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
    };
    
  }, [selection, getVideoURL, allEpisodes, videoURLs]);

  // Handle video playback
  const handlePlayPause = useCallback((index: number) => {
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
  }, [currentVideoIndex, isPlaying]);

  // Handle removing an episode from selection
  const removeFromSelection = useCallback((index: number) => {
    const newSelection = [...selection];
    newSelection.splice(index, 1);
    
    activeLearningDispatch({
      type: 'SET_SELECTION',
      payload: newSelection
    });
  }, [selection, activeLearningDispatch]);

  // Get color for an episode based on its index
  const getEpisodeColor = useCallback((episodeIdx: any) => {
    if (episodeIdx === -1) return '#888888';
    return d3.interpolateCool(episodeIdx / Math.max(1, allEpisodes.length - 1));
  }, [allEpisodes.length]);

  // Render placeholder image for states
  const renderStatePlaceholder = useCallback(() => (
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
  ), []);

  // Create a reference for a video element
  const setVideoRef = useCallback((el: HTMLVideoElement | null, index: number) => {
    videoRefs.current[index] = el;
  }, []);

  // Get title based on selection type
  const title = useMemo(() => {
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
        return `Selected Cluster (${selectionData.data.length} states)`;
      case 'coordinate':
        return 'Selected Coordinate';
      default:
        return 'Selection';
    }
  }, [selectionData]);

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
        return (
          <Grid container spacing={2}>
            {selection.map((datapoint, index) => {
              if (datapoint.type !== 'trajectory') return null;
              
              const theEpisode: Episode = allEpisodes[datapoint.data];
              if (!theEpisode) {
                return null; // Skip invalid episodes
              }
              
              const episodeColor = getEpisodeColor(datapoint.data);
              const episodeID = IDfromEpisode(theEpisode);
              const videoURL = videoURLs.get(episodeID);
  
              return (
                <Grid item xs={12} sm={6} md={4} key={`trajectory-${index}-${episodeID}`}>
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
  
                    <CardActionArea
                      onClick={() => handlePlayPause(index)}
                      onMouseEnter={() => {
                        if (!isPlaying || currentVideoIndex !== index) {
                          videoRefs.current[index]?.play();
                        }
                      }}
                      onMouseLeave={() => {
                        if (currentVideoIndex !== index) {
                          videoRefs.current[index]?.pause();
                        }
                      }}
                    >
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
                          label={`Episode ID: ${theEpisode.episode_num}`}
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
        const clusterLabel = selectionData.label;
        const clusterIndices = selectionData.data;
        
        // Limit the number of states shown to avoid rendering too many
        const maxStatesToShow = 8;
        const limitedIndices = clusterIndices.slice(0, maxStatesToShow);
        
        return (
          <Box>
            <Typography variant="h6" gutterBottom>
              Cluster {clusterLabel} Selected ({clusterIndices.length} states)
            </Typography>
            <Grid container spacing={2}>
              {limitedIndices.map((i) => (
                <Grid item xs={6} sm={4} md={3} key={`cluster-state-${i}`}>
                  <Card>
                    <CardContent>
                      {renderStatePlaceholder()}
                      <Typography variant="caption" align="center" display="block">
                        State #{i}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
              {clusterIndices.length > maxStatesToShow && (
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    + {clusterIndices.length - maxStatesToShow} more states not shown
                  </Typography>
                </Grid>
              )}
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

  return (
    <Box sx={{ padding: 2, height: '100%', overflow: 'auto' }}>
      <Typography variant="h5" gutterBottom>
        {title}
      </Typography>
      {renderSelection()}
    </Box>
  );
};

export default SelectionView;