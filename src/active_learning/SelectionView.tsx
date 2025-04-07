import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  ButtonGroup,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel,
  Divider
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  SkipNext,
  SkipPrevious,
  Speed,
  Replay,
  Save
} from '@mui/icons-material';
import { useAppState, useAppDispatch } from '../AppStateContext';

const SelectionView = () => {
  const appState = useAppState();
  const dispatch = useAppDispatch();
  
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [autoPlay, setAutoPlay] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState('');
  
  // Dummy episode list
  const episodes = [
    { id: 'ep_001', name: 'Episode 1' },
    { id: 'ep_002', name: 'Episode 2' },
    { id: 'ep_003', name: 'Episode 3' },
    { id: 'ep_004', name: 'Episode 4' },
  ];
  
  const handleEpisodeChange = (event) => {
    setSelectedEpisode(event.target.value);
  };
  
  const handleSpeedChange = (_, newValue) => {
    setPlaybackSpeed(newValue);
  };
  
  const handleAutoPlayToggle = () => {
    setAutoPlay(!autoPlay);
  };
  
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Episode Selection */}
      <FormControl variant="outlined" size="small" sx={{ mb: 2 }}>
        <InputLabel id="episode-select-label">Episode</InputLabel>
        <Select
          labelId="episode-select-label"
          id="episode-select"
          value={selectedEpisode}
          onChange={handleEpisodeChange}
          label="Episode"
        >
          {episodes.map((episode) => (
            <MenuItem key={episode.id} value={episode.id}>
              {episode.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      {/* Playback Controls */}
      <Box sx={{ mb: 2 }}>
        <ButtonGroup variant="outlined" fullWidth>
          <Button>
            <SkipPrevious />
          </Button>
          <Button>
            <Pause />
          </Button>
          <Button>
            <PlayArrow />
          </Button>
          <Button>
            <SkipNext />
          </Button>
        </ButtonGroup>
      </Box>
      
      {/* Speed Control */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="body2" display="flex" alignItems="center" gutterBottom>
          <Speed fontSize="small" sx={{ mr: 1 }} />
          Playback Speed
        </Typography>
        <Slider
          value={playbackSpeed}
          onChange={handleSpeedChange}
          step={0.25}
          marks
          min={0.25}
          max={2}
          valueLabelDisplay="auto"
          valueLabelFormat={(value) => `${value}x`}
        />
      </Box>
      
      <Divider sx={{ my: 1 }} />
      
      {/* Additional Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <FormControlLabel
          control={
            <Switch
              checked={autoPlay}
              onChange={handleAutoPlayToggle}
              size="small"
            />
          }
          label="Auto Play"
        />
      </Box>
      
      {/* Action Buttons */}
      <Box sx={{ mt: 'auto', display: 'flex', gap: 1 }}>
        <Button
          variant="outlined"
          startIcon={<Replay />}
          size="small"
          sx={{ flex: 1 }}
        >
          Reset
        </Button>
        <Button
          variant="contained"
          startIcon={<Save />}
          color="primary"
          size="small"
          sx={{ flex: 1 }}
        >
          Save Progress
        </Button>
      </Box>
    </Box>
  );
};

export default SelectionView;