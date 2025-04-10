import React, { useState, useRef, useEffect, useCallback } from 'react';
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
} from '@mui/icons-material';
import { useAppState, useAppDispatch } from '../AppStateContext';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import * as d3 from 'd3';
import axios from 'axios';
import { Episode } from '../types';
import { IDfromEpisode } from "../id";
import { useGetter } from "../getter-context";

const SelectionView = () => {
  const appState = useAppState();
  const dispatch = useAppDispatch();
  const activeLearningState = useActiveLearningState();
  const activeLearningDispatch = useActiveLearningDispatch();

  // State for currently playing video
  const [currentVideoIndex, setCurrentVideoIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedEpisodes, setSelectedEpisodes] = useState<any[]>([]);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [videoURLs, setVideoURLs] = useState<Map<string, string>>(new Map<string, string>());

  // Get video URL from context
  const { getVideoURL } = useGetter();

  // Get selected episodes from state
  const selection = activeLearningState.selection || [];
  // Get all episodes for color calculation
  const allEpisodes = appState.episodeIDsChronologically || [];

  useEffect(() => {
    // Select from all episodes based on index
    const selectedEpisodeList = selection.map((epIndex) => {
      return { selectionIndex: epIndex, ...allEpisodes[epIndex] };
    }
    );
    setSelectedEpisodes(selectedEpisodeList);
  }
    , [selection, allEpisodes]);

  // set videoURLs for selected episodes, be aware that getVideoURL is async promise
  useEffect(() => {
    const fetchVideoURLs = async () => {
      const videoURLmap = new Map<string, string>();
      const urls = await Promise.all(
        selectedEpisodes.map(async (episode) => {
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
    , [selectedEpisodes, getVideoURL]);

  // Initialize refs array when selection changes
  useEffect(() => {
    videoRefs.current = videoRefs.current.slice(0, selectedEpisodes.length);
  }, [selectedEpisodes.length]);


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
    const newSelection = [...selectedEpisodes];
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
      // Adjust currentVideoIndex if a video before it was removed
      setCurrentVideoIndex(currentVideoIndex - 1);
    }
  };

  // Get color for an episode based on its index
  const getEpisodeColor = (episodeIdx: any) => {
    console.log('Episode Index:', episodeIdx, allEpisodes);
    if (episodeIdx === -1) return '#888888'; // Default color if not found
    return d3.interpolateCool(episodeIdx / Math.max(1, allEpisodes.length - 1));
  };

  // Create a reference for a video element
  const setVideoRef = (el: HTMLVideoElement | null, index: number) => {
    videoRefs.current[index] = el;
  };

  // Handle metadata loaded event
  const handleMetadataLoaded = () => {
    // This function is called when video metadata is loaded
    // Could be used for video duration, etc.
  };

  return (
    <Box sx={{ padding: 2 }}>
      <Typography variant="h5" gutterBottom>
        Selected Episodes ({selectedEpisodes.length})
      </Typography>

      {selectedEpisodes.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center', bgcolor: 'background.paper' }}>
          <Typography variant="body1" color="text.secondary">
            No episodes selected. Use the + button to add episodes.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {selectedEpisodes.map((episode, index) => {
            const episodeColor = getEpisodeColor(episode.selectionIndex);
            const videoURL = videoURLs.get(IDfromEpisode(episode));

            return (
              <Grid item xs={12} sm={6} md={4} key={index}>
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
                        label={`Episode ID: ${episode.episode_num}`}
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
      )}
    </Box>
  );
};

export default SelectionView;