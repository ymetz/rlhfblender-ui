import { useCallback, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAppDispatch, useAppState } from './AppStateContext';
import { useSetupConfigDispatch, useSetupConfigState } from './SetupConfigContext';
import { SequenceElement, UIConfig } from './types';
import { IDfromEpisode } from './id';
import _ from 'lodash';

export const useConfigBasedSampling = () => {
  const dispatch = useAppDispatch();
  const configDispatch = useSetupConfigDispatch();
  const state = useAppState();
  const configState = useSetupConfigState();
  
  // Add refs to track state and prevent race conditions
  const isProcessing = useRef(false);
  const isInitialized = useRef(false);

  // Check if we have all required data
  const isReadyToProgress = useCallback(() => {
    return configState.uiConfigSequence?.length > 0 && 
           state.episodeIDsChronologically?.length > 0 &&
           state.selectedExperiment.id !== -1;
  }, [configState.uiConfigSequence, state.episodeIDsChronologically, state.selectedExperiment.id]);

  const validateBatchSizes = useCallback((uiConfigs: UIConfig[]) => {
    const sizes = uiConfigs.map(config => config.max_ranking_elements);
    const allEqual = sizes.every(size => size === sizes[0]);
    
    if (!allEqual) {
      console.warn('Warning: UI Configs have different max_ranking_elements.');
    }
  }, []);

  const advanceToNextStep = useCallback(async () => {
    // Prevent concurrent processing
    if (isProcessing.current) {
      console.log('Already processing step advancement');
      return false;
    }
    
    try {
      isProcessing.current = true;

      if (!isReadyToProgress()) {
        console.log('Not ready to advance, missing required data');
        return false;
      }

      const nextStep = state.currentStep + 1;
      
      // Check if we've reached the end of the sequence
      if (nextStep >= configState.uiConfigSequence.length) {
        await dispatch({ type: 'SET_CURRENT_STEP', payload: nextStep });
        await dispatch({ type: 'SET_END_MODAL_OPEN' });

        try {
          await axios.post('/data/submit_session', { sessionId: state.sessionId });
          console.log('Session submitted successfully');
        } catch (error) {
          console.error('Error submitting session:', error);
        }

        return false;
      }

      // Advance to next step
      await dispatch({ type: 'SET_CURRENT_STEP', payload: nextStep });
      return true;
      
    } finally {
      isProcessing.current = false;
    }
  }, [
    state.currentStep,
    state.sessionId,
    configState.uiConfigSequence?.length,
    dispatch,
    isReadyToProgress
  ]);

  const sampleEpisodes = useCallback(async () => {
    // Prevent concurrent processing
    if (isProcessing.current) {
      console.log('Already processing episode sampling');
      return;
    }

    try {
      isProcessing.current = true;

      if (!isReadyToProgress()) {
        console.log('Required data not available for sampling');
        return;
      }

      validateBatchSizes(configState.allUIConfigs);

      const currentStep = state.currentStep;
      const currentSequenceElement: SequenceElement = configState.uiConfigSequence[currentStep];
      
      if (!currentSequenceElement) {
        await dispatch({ type: 'SET_END_MODAL_OPEN' });
        return;
      }

      const currentBatchEpisodes = currentSequenceElement.batch.map(index => state.episodeIDsChronologically[index]);
      
      if (!currentBatchEpisodes?.length) {
        console.log('No episodes available for current batch');
        return;
      }

      const currentUIConfig = configState.allUIConfigs.find(
        config => config.id === currentSequenceElement.uiConfig.id
      );

      if (currentUIConfig) {
        await configDispatch({
          type: 'SET_ACTIVE_UI_CONFIG',
          payload: currentUIConfig
        });
      }

      await dispatch({
        type: 'SET_RANKEABLE_EPISODE_IDS',
        payload: currentBatchEpisodes.map(e => IDfromEpisode(e)),
      });

    } catch (error) {
      console.error('Error in sampleEpisodes:', error);
    } finally {
      isProcessing.current = false;
    }
  }, [
    state.currentStep,
    state.episodeIDsChronologically,
    configState.uiConfigSequence,
    configState.allUIConfigs,
    dispatch,
    configDispatch,
    validateBatchSizes,
    isReadyToProgress
  ]);

  // Handle initial loading
  useEffect(() => {
    if (!isInitialized.current && isReadyToProgress()) {
      isInitialized.current = true;
      sampleEpisodes();
    }
  }, [isReadyToProgress, sampleEpisodes]);

  // Reset initialization when experiment changes
  useEffect(() => {
    if (state.selectedExperiment.id !== -1) {
      isInitialized.current = false;
    }
  }, [state.selectedExperiment.id]);

  return { sampleEpisodes, advanceToNextStep };
};