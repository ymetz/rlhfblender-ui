// App.tsx

import React, { useCallback, useEffect, useMemo } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box, IconButton, Chip, Typography, Button } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { SelectChangeEvent } from '@mui/material/Select';

import axios from 'axios';

import Menu from './components/menubar/Menu';
import ConfigModal from './components/modals/config-modal';
import ExperimentStartModal from './components/modals/experiment-start-modal';
import ExperimentEndModal from './components/modals/experiment-end-modal';
import FeedbackInterface from './components/FeedbackInterface';
import { GetterContext } from './getter-context';

import { AppStateProvider, useAppState, useAppDispatch } from './AppStateContext';
import getDesignTokens from './theme';
import { EpisodeFromID } from './id';
import { BackendConfig, UIConfig } from './types';

const App: React.FC = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const initializeData = () => {
      const url = new URL(window.location.href);
      const studyMode = url.searchParams.get('studyMode') || 'study';
      if (studyMode === 'configure') {
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
        dispatch({ type: 'SET_ALL_UI_CONFIGS', payload: res.data });
      });

      axios.get('/backend_configs').then((res) => {
        dispatch({ type: 'SET_ALL_BACKEND_CONFIGS', payload: res.data });
      });
    };

    initializeData();
  }, []); // Empty dependency array ensures this runs once


  const handleToggleStatusBar = () => {
    dispatch({ type: 'TOGGLE_STATUS_BAR' });
  };

  const closeUIConfigModal = ( config: UIConfig | null) => {

    if (config) {
      // update the list of UI configs
      dispatch({ type: 'SET_ALL_UI_CONFIGS', payload: [...state.allUIConfigs, config] });
      axios.post('/save_ui_config', config).then(() => {
        console.log('Config saved for study');
      }
      );
    }
    dispatch({ type: 'SET_UI_CONFIG_MODAL_OPEN', payload: false });
  };

  const closeBackendConfigModal = ( config: BackendConfig | null) => {
    if (config) {
      // update the list of Backend configs
      dispatch({ type: 'SET_ALL_BACKEND_CONFIGS', payload: [...state.allBackendConfigs, config] });
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

  const getRewards = useCallback( async (episodeId: string) => {
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
            <Menu />
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
            <FeedbackInterface/>
          ) : null}
          <ConfigModal
            config={state.activeUIConfig}
            open={state.uiConfigModalOpen}
            onClose={closeUIConfigModal}
          />
          <ConfigModal
            config={state.activeBackendConfig}
            open={state.backendConfigModalOpen}
            onClose={closeBackendConfigModal}
          />
          <ExperimentStartModal />
          <ExperimentEndModal open={state.endModalOpen} />
          <Button
            sx={{
              position: 'absolute',
              bottom: '2vh',
              right: '2vw',
              visibility: state.app_mode === 'configure' ? 'visible' : 'hidden',
            }}
            variant="contained"
            onClick={() => {
              axios.post('/save_ui_config', state.activeUIConfig).then(() => {
                console.log('Config saved for study');
              });
            }}
          >
            Save Current Config For Study
          </Button>
        </Box>
      </GetterContext.Provider>
    </ThemeProvider>
  );
};

const AppWrapper = () => (
  <AppStateProvider>
    <App />
  </AppStateProvider>
);

export default AppWrapper;
