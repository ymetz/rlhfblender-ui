// Menu.tsx

import React from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  InputLabel,
  MenuItem,
  FormControl,
  Select,
  Button,
  Tooltip,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import { useTheme } from '@mui/material/styles';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import axios from 'axios';

import { useAppState, useAppDispatch } from '../../AppStateContext';
import { IDfromEpisode } from '../../id';

const Menu: React.FC = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const theme = useTheme();

  // Handle project selection
  const selectProject = (event: SelectChangeEvent) => {
    const selectedProject = state.projects.find(
      (project) => project.id === Number(event.target.value)
    ) || state.selectedProject;

    // Filter experiments related to the selected project
    const projectExperiments = selectedProject.project_experiments || [];
    const filteredExperiments = state.experiments.filter((experiment) =>
      projectExperiments.includes(experiment.exp_name)
    );

    dispatch({ type: 'SET_SELECTED_PROJECT', payload: selectedProject });
    dispatch({ type: 'SET_FILTERED_EXPERIMENTS', payload: filteredExperiments });
  };

  // Handle experiment selection
  const selectExperiment = (event: SelectChangeEvent) => {
    const selectedExperiment = state.filtered_experiments.find(
      (experiment) => experiment.id === Number(event.target.value)
    ) || state.selectedExperiment;

    dispatch({ type: 'SET_SELECTED_EXPERIMENT', payload: selectedExperiment });
  };

  // Handle UI config selection
  const selectUIConfig = (event: SelectChangeEvent) => {
    const selectedUIConfig = state.allUIConfigs.find(
      (config) => config.id === Number(event.target.value)
    ) || state.activeUIConfig;

    dispatch({ type: 'SET_ACTIVE_UI_CONFIG', payload: selectedUIConfig });
  };

  // Handle Backend config selection
  const selectBackendConfig = (event: SelectChangeEvent) => {
    const selectedBackendConfig = state.allBackendConfigs.find(
      (config) => config.id === Number(event.target.value)
    ) || state.activeBackendConfig;

    dispatch({ type: 'SET_ACTIVE_BACKEND_CONFIG', payload: selectedBackendConfig });
  };

  // Handle theme selection
  const selectTheme = (event: SelectChangeEvent) => {
    dispatch({ type: 'SET_THEME', payload: event.target.value });
  };

  // Create custom UI Config
  const createCustomUIConfig = () => {
    dispatch({ type: 'SET_UI_CONFIG_MODAL_OPEN', payload: true });
  };

  // Create custom Backend Config
  const createCustomBackendConfig = () => {
    dispatch({ type: 'SET_BACKEND_CONFIG_MODAL_OPEN', payload: true });
  };

  // Reset Sampler
  const resetSampler = () => {
    if (state.selectedExperiment.id === -1) {
      return;
    }
    axios
      .post(
        '/data/reset_sampler?experiment_id=' +
        state.selectedExperiment.id +
        '&sampling_strategy=' +
        state.activeBackendConfig.samplingStrategy
      )
      .then((res) => {
        dispatch({ type: 'SET_SESSION_ID', payload: res.data.session_id });
        dispatch({ type: 'CLEAR_SCHEDULED_FEEDBACK' });

        // Fetch the episodes and action labels after reset
        getEpisodeIDsChronologically(() => {
          sampleEpisodes();
        });
        getActionLabels(res.data.environment_id);
      });
  };

  // Fetch episodes
  const getEpisodeIDsChronologically = async (callback?: () => void) => {
    try {
      const response = await axios.get('/data/get_all_episodes');
      dispatch({ type: 'SET_EPISODE_IDS_CHRONOLOGICALLY', payload: response.data });
      if (callback) callback();
    } catch (error) {
      console.error('Error fetching episodes:', error);
    }
  };

  // Fetch action labels
  const getActionLabels = async (envId: string) => {
    try {
      const response = await axios.post('/data/get_action_label_urls', { envId });
      dispatch({ type: 'SET_ACTION_LABELS', payload: response.data });
    } catch (error) {
      console.error('Error fetching action labels:', error);
    }
  };


  const sampleEpisodes = async () => {
    if (state.selectedExperiment.id === -1) {
      return;
    }
    try {
      const response = await axios.get('/data/sample_episodes', {
        params: { num_episodes: state.activeUIConfig.max_ranking_elements },
      });
      dispatch({
        type: 'SET_ACTIVE_EPISODES',
        payload: response.data.map((e: any) => IDfromEpisode(e)),
      });
      dispatch({
        type: 'SET_RANKEABLE_EPISODE_IDS',
        payload: response.data.map((e: any) => IDfromEpisode(e)),
      });
    } catch (error) {
      console.error('Error sampling episodes:', error);
    }
  };

  return (
    <Collapse in={!state.status_bar_collapsed} timeout="auto" sx={{ display: 'flex' }}>
      <Box
        sx={{
          m: 2,
          display: 'flex',
          justifyContent: 'space-evenly',
          backgroundColor: theme.palette.background.default,
        }}
      >
        <FormControl sx={{ width: '10vw', marginRight: '2vw' }}>
          <InputLabel id="project-select-label">Project</InputLabel>
          <Select
            labelId="project-select-label"
            id="project-select"
            value={state.selectedProject.id >= 0 ? state.selectedProject.id.toString() : ''}
            label="Project"
            onChange={selectProject}
          >
            {state.projects.map((project) => (
              <MenuItem key={project.id} value={project.id.toString()}>
                {project.project_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ width: '10vw', marginRight: '2vw' }}>
          <InputLabel id="experiment-select-label">Experiment</InputLabel>
          <Select
            labelId="experiment-select-label"
            id="experiment-select"
            value={state.selectedExperiment.id >= 0 ? state.selectedExperiment.id.toString() : ''}
            label="Experiment"
            onChange={selectExperiment}
          >
            {state.filtered_experiments.map((experiment) => (
              <MenuItem key={experiment.id} value={experiment.id.toString()}>
                {experiment.exp_name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ width: '10vw', marginRight: '2vw' }}>
          <InputLabel id="backend-config-select-label">Backend Config</InputLabel>
          <Select
            labelId="backend-config-select-label"
            id="backend-config-select"
            value={state.activeBackendConfig.id.toString()}
            label="Backend Config"
            onChange={selectBackendConfig}
          >
            {state.allBackendConfigs.map((config) => (
              <MenuItem key={config.id.toString()} value={config.id.toString()}>
                {config.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ marginRight: '2vw', marginTop: '1vh' }}>
          <Tooltip title="Create New Backend Config">
            <IconButton onClick={createCustomBackendConfig}>
              <LibraryAddIcon sx={{ color: theme.palette.text.secondary }} />
            </IconButton>
          </Tooltip>
        </FormControl>

        <FormControl sx={{ width: '10vw', marginRight: '2vw' }}>
          <InputLabel id="ui-config-select-label">UI Config</InputLabel>
          <Select
            labelId="ui-config-select-label"
            id="ui-config-select"
            value={state.activeUIConfig.id.toString()}
            label="UI Config"
            onChange={selectUIConfig}
          >
            {state.allUIConfigs.map((config) => (
              <MenuItem key={config.id.toString()} value={config.id.toString()}>
                {config.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ marginRight: '2vw', marginTop: '1vh' }}>
          <Tooltip title="Create New UI Config">
            <IconButton onClick={createCustomUIConfig}>
              <LibraryAddIcon sx={{ color: theme.palette.text.secondary }} />
            </IconButton>
          </Tooltip>
        </FormControl>

        <FormControl sx={{ width: '5vw', marginRight: '2vw', marginTop: '1vh' }}>
          <Button variant="contained" onClick={resetSampler}>
            Load
          </Button>
        </FormControl>

        <FormControl sx={{ width: '10vw', marginRight: '2vw' }}>
          <InputLabel id="theme-select-label">Theme</InputLabel>
          <Select
            labelId="theme-select-label"
            id="theme-select"
            value={state.theme}
            label="Theme"
            onChange={selectTheme}
          >
            {state.allThemes.map((themeOption, index) => (
              <MenuItem key={index} value={themeOption}>
                {themeOption}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ width: '25vw', marginRight: '2vw', float: 'right' }}>
          <Typography
            sx={{
              marginRight: '2vw',
              marginTop: '1vh',
              color: theme.palette.text.primary,
            }}
          >
            Session: {state.sessionId}
          </Typography>
        </FormControl>
      </Box>
    </Collapse>
  );
};

export default Menu;
