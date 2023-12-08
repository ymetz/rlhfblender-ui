import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Collapse from '@mui/material/Collapse';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import {Project, Experiment, UIConfig, BackendConfig} from '../../types';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import {useTheme} from '@mui/material/styles';
import React from 'react';

interface MenuProps {
  statusBarCollapsed: boolean;
  selectedProjectId: string;
  selectProject: (event: SelectChangeEvent) => void;
  projects: Project[];
  selectedExperimentId: string;
  selectExperiment: (event: SelectChangeEvent) => void;
  experiments: Experiment[];
  activeUIConfigId: string;
  activeBackendConfigId: string;
  selectUIConfig: (event: SelectChangeEvent) => void;
  selectBackendConfig: (event: SelectChangeEvent) => void;
  allUIConfigs: UIConfig[];
  allBackendConfigs: BackendConfig[];
  allThemes: string[];
  selectTheme: (event: SelectChangeEvent) => void;
  activeTheme: string;
  createCustomUIConfig: () => void;
  createCustomBackendConfig: () => void;
  resetSampler: () => void;
  sessionId: string;
}

const Menu: React.FC<MenuProps> = ({
  statusBarCollapsed,
  selectedProjectId,
  selectProject,
  projects,
  selectedExperimentId,
  selectExperiment,
  experiments,
  activeUIConfigId,
  selectUIConfig,
  activeBackendConfigId,
  selectBackendConfig,
  allUIConfigs,
  allBackendConfigs,
  createCustomUIConfig,
  createCustomBackendConfig,
  allThemes,
  selectTheme,
  resetSampler,
  activeTheme,
  sessionId,
}) => {
  const theme = useTheme();
  return (
    <Collapse in={!statusBarCollapsed} timeout="auto" sx={{display: 'flex'}}>
      <Box
        sx={{
          m: 2,
          display: 'flex',
          justifyContent: 'space-evenly',
          backgroundColor: theme.palette.background.l1,
        }}
      >
        <FormControl sx={{width: '10vw', marginRight: '2vw'}}>
          <InputLabel id="project-select-label">Project</InputLabel>
          <Select
            labelId="project-select-label"
            id="demo-simple-select"
            value={selectedProjectId}
            label="Project"
            onChange={selectProject}
          >
            {projects.map((project, index) => {
              return (
                <MenuItem key={index} value={project.id.toString()}>
                  {project.project_name}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <FormControl sx={{width: '10vw', marginRight: '2vw'}}>
          <InputLabel id="experiment-select-label">Experiment</InputLabel>
          <Select
            labelId="experiment-select-label"
            id="experiment-simple-select"
            value={selectedExperimentId}
            label="Experiment"
            onChange={selectExperiment}
          >
            {experiments.map((experiment, index) => {
              return (
                <MenuItem key={index} value={experiment.id.toString()}>
                  {experiment.exp_name}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <FormControl sx={{width: '10vw', marginRight: '2vw'}}>
          <InputLabel id="config-select-label">Backend Configurations</InputLabel>
          <Select
            labelId="config-select-label"
            id="config-simple-select"
            value={activeBackendConfigId}
            label="Configurations"
            onChange={selectBackendConfig}
          >
            {allBackendConfigs.map((config, index) => {
              return (
                <MenuItem key={index} value={config.id.toString() || "-"}>
                  {config.name}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <FormControl sx={{marginRight: '2vw', marginTop: '1vh'}}>
          <Tooltip title="Create New Config">
            <IconButton onClick={createCustomBackendConfig}>
              <LibraryAddIcon sx={{color: theme.palette.text.secondary}} />
            </IconButton>
          </Tooltip>
        </FormControl>
        <FormControl sx={{width: '10vw', marginRight: '2vw'}}>
          <InputLabel id="config-select-label">UI Configuration</InputLabel>
          <Select
            labelId="config-select-label"
            id="config-simple-select"
            value={activeUIConfigId}
            label="Configurations"
            onChange={selectUIConfig}
          >
            {allUIConfigs.map((config, index) => {
              return (
                <MenuItem key={index} value={config.id.toString() || "-"}>
                  {config.name}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <FormControl sx={{marginRight: '2vw', marginTop: '1vh'}}>
          <Tooltip title="Create New Config">
            <IconButton onClick={createCustomUIConfig}>
              <LibraryAddIcon sx={{color: theme.palette.text.secondary}} />
            </IconButton>
          </Tooltip>
        </FormControl>
        <FormControl sx={{width: '5vw', marginRight: '2vw', marginTop: '1vh'}}>
          <Button variant="contained" onClick={resetSampler}>
            Load
          </Button>
        </FormControl>
        <FormControl sx={{width: '10vw', marginRight: '2vw'}}>
          <InputLabel id="theme-select-label">Theme</InputLabel>
          <Select
            labelId="theme-select-label"
            id="theme-simple-select"
            value={activeTheme}
            label="Themes"
            onChange={selectTheme}
          >
            {allThemes.map((theme, index) => {
              return (
                <MenuItem key={index} value={theme}>
                  {theme}
                </MenuItem>
              );
            })}
          </Select>
        </FormControl>
        <FormControl sx={{width: '25vw', marginRight: '2vw', float: 'right'}}>
          <Typography
            sx={{
              marginRight: '2vw',
              marginTop: '1vh',
              color: theme.palette.text.primary,
            }}
          >
            Session: {sessionId}
          </Typography>
        </FormControl>
      </Box>
    </Collapse>
  );
};

export default Menu;
