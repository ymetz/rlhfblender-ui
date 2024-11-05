// App.tsx

import React, { useCallback, useEffect, useMemo } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box, IconButton, Chip, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import axios from 'axios';

import Menu from './components/menubar/menu';
import ConfigModal from './components/modals/config-modal';
import ExperimentStartModal from './components/modals/experiment-start-modal';
import ExperimentEndModal from './components/modals/experiment-end-modal';
import FeedbackInterface from './components/FeedbackInterface';
import { GetterContext } from './getter-context';

import { AppStateProvider, useAppState, useAppDispatch } from './AppStateContext';
import { SetupConfigProvider, useSetupConfigState, useSetupConfigDispatch } from './SetupConfigContext';
import getDesignTokens from './theme';
import { EpisodeFromID, IDfromEpisode } from './id';
import { BackendConfig, UIConfig } from './types';
import { ShortcutsProvider, useShortcuts } from './ShortCutProvider';
import { ShortcutsInfoBox } from './components/shortcut-info-box';
import StudyCodeModal from './components/modals/study-code-modal';

const App: React.FC = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const configState = useSetupConfigState();
  const configDispatch = useSetupConfigDispatch();
  const { registerShortcut } = useShortcuts();

  useEffect(() => {
    const initializeData = () => {
      const url = new URL(window.location.href);
      const study_code = url.searchParams.get('study') || '';
      if (study_code !== '') {
        dispatch({ type: 'SET_STUDY_CODE', payload: study_code });
        //dispatch({ type: 'TOGGLE_STATUS_BAR' });
        dispatch({ type: 'SET_APP_MODE', payload: 'study' });
      }
      else {
        dispatch({ type: 'SET_APP_MODE', payload: 'configure' });
        dispatch({ type: 'TOGGLE_STATUS_BAR' });
      }

      // Fetch Projects, Experiments, UI Configs, Backend Configs
      axios.get('/get_all?model_name=project').then((res) => {
        dispatch({ type: 'SET_PROJECTS', payload: res.data });
      });

      axios.get('/get_all?model_name=experiment').then((res) => {
        dispatch({ type: 'SET_EXPERIMENTS', payload: res.data });
      });

      axios.get('/ui_configs').then((res) => {
        configDispatch({ type: 'SET_ALL_UI_CONFIGS', payload: res.data });
      });

      axios.get('/backend_configs').then((res) => {
        configDispatch({ type: 'SET_ALL_BACKEND_CONFIGS', payload: res.data });
      });
    };

    initializeData();
  }, []); // Empty dependency array ensures this runs once


  const handleToggleStatusBar = () => {
    dispatch({ type: 'TOGGLE_STATUS_BAR' });
  };

  const closeUIConfigModal = (config: UIConfig | null) => {

    if (config) {

      // Set config ID to the next available ID
      config.id = Math.max(...configState.allUIConfigs.map((c) => c.id), 0) + 1;
      // update the list of UI configs and set the active config 
      configDispatch({ type: 'SET_ALL_UI_CONFIGS', payload: [...configState.allUIConfigs, config] });
      axios.post('/save_ui_config', config).then(() => {
        console.log('Config saved for study');
      }
      );
    }
    dispatch({ type: 'SET_UI_CONFIG_MODAL_OPEN', payload: false });
  };

  const closeBackendConfigModal = (config: BackendConfig | null) => {
    if (config) {
      // Set config ID to the next available ID
      config.id = Math.max(...configState.allBackendConfigs.map((c) => c.id), 0) + 1;
      // update the list of Backend configs
      configDispatch({ type: 'SET_ALL_BACKEND_CONFIGS', payload: [...configState.allBackendConfigs, config] });
      // Save the config to the backend
      axios.post('/save_backend_config', config).then(() => {
        console.log('Config saved for backend');
      });
    }
    dispatch({ type: 'SET_BACKEND_CONFIG_MODAL_OPEN', payload: false });
  };

  // Moved Getter Functions
  const getVideoURL = useCallback(async (episodeId: string) => {
    if (state.videoURLCache[episodeId]) {
      return state.videoURLCache[episodeId];
    }
    try {
      const response = await axios.get('data/get_video', {
        params: EpisodeFromID(episodeId),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      dispatch({
        type: 'SET_VIDEO_URL_CACHE',
        payload: { [episodeId]: url },
      });
      return url;
    } catch (error) {
      console.error('Error fetching video URL:', error);
    }
  }, [dispatch, state.videoURLCache]);

  const getThumbnailURL = useCallback(async (episodeId: string) => {
    if (state.thumbnailURLCache[episodeId]) {
      return state.thumbnailURLCache[episodeId];
    }
    try {
      const response = await axios.get('data/get_thumbnail', {
        params: EpisodeFromID(episodeId),
        responseType: 'blob',
      });
      const url = URL.createObjectURL(response.data);
      dispatch({
        type: 'SET_THUMBNAIL_URL_CACHE',
        payload: { [episodeId]: url },
      });
      return url;
    } catch (error) {
      console.error('Error fetching thumbnail URL:', error);
    }
  }, [state.thumbnailURLCache, dispatch]);

  const getRewards = useCallback(async (episodeId: string) => {
    if (state.rewardsCache[episodeId]) {
      return state.rewardsCache[episodeId];
    }
    try {
      const response = await axios.get('data/get_rewards', {
        params: EpisodeFromID(episodeId),
      });
      const rewards = Array.from(new Float32Array(response.data));
      dispatch({
        type: 'SET_REWARDS_CACHE',
        payload: { [episodeId]: rewards },
      });
      return rewards;
    } catch (error) {
      console.error('Error fetching rewards:', error);
    }
  }, [state.rewardsCache, dispatch]);

  const getUncertainty = useCallback(async (episodeId: string) => {
    if (state.uncertaintyCache[episodeId]) {
      return state.uncertaintyCache[episodeId];
    }
    try {
      const response = await axios.get('data/get_uncertainty', {
        params: EpisodeFromID(episodeId),
      });
      const uncertainty = Array.from(new Float32Array(response.data));
      dispatch({
        type: 'SET_UNCERTAINTY_CACHE',
        payload: { [episodeId]: uncertainty },
      });
      return uncertainty;
    } catch (error) {
      console.error('Error fetching uncertainty:', error);
    }
  }, [state.uncertaintyCache, dispatch]);

  const getterContextValue = useMemo(() => ({
    getVideoURL,
    getThumbnailURL,
    getRewards,
    getUncertainty,
  }), [getVideoURL, getThumbnailURL, getRewards, getUncertainty]);

  useEffect(() => {
    // Register example shortcuts
    const shortcuts = {
      save: { key: '↵', description: 'Submit/Next' },
      reset: { key: '+', description: 'Increase Score' },
      play: { key: '-', description: 'Decrease Score' },
      next: { key: 'space', description: 'Play/Pause Video' },
      prev: { key: 'W', description: 'Move item up' },
      zoom: { key: 'S', description: 'Move item down' },
      demo: { key: 'D', description: 'Generate Demo' },
      feature: { key: 'F', description: 'Feature Annotation' },
    };

    Object.entries(shortcuts).forEach(([id, shortcut]) => {
      registerShortcut(id, {
        ...shortcut,
        action: () => console.log(`${shortcut.description}...`)
      });
    });
  }, [registerShortcut]);

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
          params: { num_episodes: configState.activeUIConfig.max_ranking_elements },
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
          configState.activeBackendConfig.samplingStrategy
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


    const handleExperimentStartClose = async () => {
      if (state.app_mode === 'study') {
        try {
          const res = await axios.post('/load_setup', { study_code: state.studyCode });
  
          await dispatch({ type: 'SET_SELECTED_PROJECT', payload: res.data.project });
          await dispatch({ type: 'SET_SELECTED_EXPERIMENT', payload: res.data.experiment });
          await configDispatch({ type: 'SET_ACTIVE_UI_CONFIG', payload: res.data.ui_config });
          await configDispatch({ type: 'SET_ACTIVE_BACKEND_CONFIG', payload: res.data.backend_config });
  
          // Set the flag to true
          await dispatch({ type: 'SET_SETUP_COMPLETE', payload: true });
        } catch (error) {
          console.error('Error loading setup:', error);
        }
      }
    };

    useEffect(() => {
      if (state.setupComplete) {
        resetSampler();
        // Reset the flag after calling resetSampler
        dispatch({ type: 'SET_SETUP_COMPLETE', payload: false });
      }
    }, [state.setupComplete, dispatch]);

  return (
    <ThemeProvider theme={createTheme(getDesignTokens(state.theme as 'light' | 'dark'))}>
      <GetterContext.Provider value={getterContextValue}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              height: '100vh',
              width: '100vw',
            }}
          >
            <Box
              id="menu"
              sx={{
                flexDirection: 'column',
                bgcolor: createTheme(getDesignTokens(state.theme as 'light' | 'dark')).palette.background.l1,
              }}
            >
              <Menu
                resetSampler={resetSampler}
              />
              <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                <IconButton
                  disabled={state.app_mode === 'study'}
                  onClick={handleToggleStatusBar}
                >
                  {state.status_bar_collapsed ? (
                    <ExpandMoreIcon />
                  ) : (
                    <ExpandLessIcon />
                  )}
                </IconButton>
                <Chip
                  label={state.sessionId !== '-' ? 'Status: Active' : 'Status: Waiting'}
                  color={state.sessionId !== '-' ? 'success' : 'info'}
                  sx={{
                    marginRight: '2vw',
                    marginTop: '0.2vh',
                    float: 'right',
                  }}
                />
                {state.status_bar_collapsed && (
                  <Typography
                    sx={{
                      width: '45vw',
                      fontWeight: 'bold',
                      margin: 'auto',
                      marginTop: '0.6vh',
                      float: 'right',
                    }}
                  >
                    RLHF-Blender v0.3
                  </Typography>
                )}
              </Box>
            </Box>
            {state.selectedProject.id >= 0 ? (
              <FeedbackInterface />
            ) : null}
            <ConfigModal
              config={configState.activeUIConfig}
              open={state.uiConfigModalOpen}

              onClose={closeUIConfigModal}
            />
            <ConfigModal
              config={configState.activeBackendConfig}
              open={state.backendConfigModalOpen}
              onClose={closeBackendConfigModal}
            />
            <ExperimentStartModal
              onClose={handleExperimentStartClose}
            />
            <ExperimentEndModal open={state.endModalOpen} />
            <ShortcutsInfoBox />
            <StudyCodeModal open={state.showStudyCode} onClose={() => dispatch({ type: 'TOGGLE_STUDY_CODE' })} studyCode={state.studyCode} />
          </Box>
      </GetterContext.Provider>
    </ThemeProvider>
  );
};

const AppWrapper = () => (
  <AppStateProvider>
    <SetupConfigProvider>
      <ShortcutsProvider>
        <App />
      </ShortcutsProvider>
    </SetupConfigProvider>
  </AppStateProvider>
);

export default AppWrapper;