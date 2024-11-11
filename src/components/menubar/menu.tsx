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
import { useSetupConfigState, useSetupConfigDispatch } from '../../SetupConfigContext';

type MenuProps = {
  resetSampler: () => void;
};

const Menu: React.FC<MenuProps> = ({ resetSampler }: MenuProps) => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const setupConfigState = useSetupConfigState();
  const configDispatch = useSetupConfigDispatch();
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
    const selectedUIConfig = setupConfigState.allUIConfigs.find(
      (config) => config.id === Number(event.target.value)
    ) || setupConfigState.activeUIConfig;

    configDispatch({ type: 'SET_ACTIVE_UI_CONFIG', payload: selectedUIConfig });
  };

  // Handle Backend config selection
  const selectBackendConfig = (event: SelectChangeEvent) => {
    const selectedBackendConfig = setupConfigState.allBackendConfigs.find(
      (config) => config.id === Number(event.target.value)
    ) || setupConfigState.activeBackendConfig;

    configDispatch({ type: 'SET_ACTIVE_BACKEND_CONFIG', payload: selectedBackendConfig });
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

  return (
    <Collapse in={!state.status_bar_collapsed} timeout="auto" sx={{ display: 'flex', backgroundColor: theme.palette.background.l0 }}>
      <Box
        sx={{
          m: 2,
          display: 'flex',
          justifyContent: 'space-evenly',
          backgroundColor: theme.palette.background.l0,
        }}
      >
        <FormControl sx={{ width: '10vw', marginRight: '2vw' }}>
          <InputLabel id="project-select-label">Project</InputLabel>
          <Select
            labelId="project-select-label"
            id="project-select"
            value={state.selectedProject.id >= -1 ? state.selectedProject.id.toString() : ''}
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
            value={state.selectedExperiment.id >= -1 ? state.selectedExperiment.id.toString() : ''}
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
            value={setupConfigState.activeBackendConfig.id.toString()}
            label="Backend Config"
            onChange={selectBackendConfig}
          >
            {setupConfigState.allBackendConfigs.map((config) => (
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
            value={setupConfigState.activeUIConfig.id.toString()}
            label="UI Config"
            onChange={selectUIConfig}
          >
            {setupConfigState.allUIConfigs.map((config) => (
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
              maxWidth: '30ch',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            >
            Session: {state.sessionId}
            </Typography>
        </FormControl>

        <Button
          sx={{
            marginRight: '2vw',
            marginTop: '1vh',
            fontSize: '0.8rem',
            width: '10vw',
            visibility: state.app_mode === 'configure' ? 'visible' : 'hidden',
          }}
          variant="contained"
          color="success"
          onClick={() => {
            //dispatch({ type: 'SET_APP_MODE', payload: 'study' });
            //dispatch({ type: 'TOGGLE_STATUS_BAR' });
            // save current configs, project, etc. as setup, return study code and display it
            axios.post('/save_setup', {
              project: state.selectedProject,
              experiment: state.selectedExperiment,
              ui_config: setupConfigState.activeUIConfig,
              backend_config: setupConfigState.activeBackendConfig,
            }).then((res) => {
              if (res.data.error) {
                console.error(res.data.error);
                return;
              }
              dispatch({ type: 'SET_STUDY_CODE', payload: res.data.study_code });
              dispatch({ type: 'TOGGLE_STUDY_CODE' });
            });
          }}
        >
          Save Setup
        </Button>
      </Box>
    </Collapse>
  );
};

export default Menu;
