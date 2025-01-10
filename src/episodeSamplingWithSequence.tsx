import { useCallback } from 'react';
import axios from 'axios';
import { useAppDispatch, useAppState } from './AppStateContext';
import { useSetupConfigDispatch, useSetupConfigState } from './SetupConfigContext';
import { Episode, SequenceElement, UIConfig } from './types';
import { IDfromEpisode } from './id';
import _ from 'lodash';

export const useConfigBasedSampling = () => {
  const dispatch = useAppDispatch();
    const configDispatch = useSetupConfigDispatch();
  const state = useAppState();
  const configState = useSetupConfigState();

  const validateBatchSizes = useCallback((uiConfigs: UIConfig[]) => {
    const sizes = uiConfigs.map(config => config.max_ranking_elements);
    const allEqual = sizes.every(size => size === sizes[0]);
    
    if (!allEqual) {
      console.warn('Warning: UI Configs have different max_ranking_elements. ' +
        'This may result in uneven batch sizes across different UI configs.');
    }
  }, []);

  const generateBatchAssignments = useCallback((episodes: Episode[], sequence: SequenceElement[], allUIConfigs: UIConfig[]) => {
    // Group sequence elements by batch number
    const batchGroups = _.groupBy(sequence, 'batch');
    const assignments: { [batchId: number]: Episode[] } = {};
    
    let episodeIndex = 0;

    // Process each batch
    Object.entries(batchGroups).forEach(([batchId, elements]) => {
      assignments[parseInt(batchId)] = [];
      
      // For each sequence element in this batch
      elements.forEach(element => {
        // Find the corresponding UI config
        const uiConfig = allUIConfigs.find(config => config.id === element.uiConfig.id);
        if (!uiConfig) return;

        // Get the number of episodes needed for this UI config
        const episodesNeeded = Math.min(
          uiConfig.max_ranking_elements,
          episodes.length - episodeIndex
        );

        // Add episodes to this batch
        if (episodesNeeded > 0) {
          assignments[parseInt(batchId)].push(
            ...episodes.slice(episodeIndex, episodeIndex + episodesNeeded)
          );
          episodeIndex += episodesNeeded;
        }
      });
    });

    return assignments;
  }, []);

  const advanceToNextStep = useCallback(() => {
    const nextStep = state.currentStep + 1;
    
    // Check if we've reached the end of the sequence
    if (nextStep >= configState.uiConfigSequence.length) {
      dispatch({ type: 'SET_CURRENT_STEP', payload: nextStep });
      dispatch({ type: 'SET_END_MODAL_OPEN' });

      axios.post('/data/submit_session', { sessionId: state.sessionId }).then(() => {
        console.log('Session submitted');
      }).catch((error) => {
        console.error('Error submitting session', error);
      });

      return false;
    }

    dispatch({ type: 'SET_CURRENT_STEP', payload: nextStep });
    return true;
  }, [state.currentStep, dispatch, configState.uiConfigSequence.length, state.sessionId]);

  const sampleEpisodes = useCallback(async () => {
    if (state.selectedExperiment.id === -1) {
      return;
    }

    // If no UI config sequence is set, use active UI config
    if (!configState.uiConfigSequence.length) {
      const maxElements = configState.activeUIConfig.max_ranking_elements;
      const currentBatchEpisodes = state.episodeIDsChronologically.slice(0, maxElements);
      
      dispatch({
        type: 'SET_RANKEABLE_EPISODE_IDS',
        payload: currentBatchEpisodes.map(e => IDfromEpisode(e)),
      });
      return;
    }

    // Validate batch sizes
    validateBatchSizes(configState.allUIConfigs);

    // Get current batch number based on progress
    const currentStep = state.currentStep;
    const currentSequenceElement = configState.uiConfigSequence[currentStep];
    
    if (!currentSequenceElement) {
      dispatch({ type: 'SET_END_MODAL_OPEN' });
      return;
    }

    // Generate batch assignments if not already cached
    const batchAssignments = generateBatchAssignments(
      state.episodeIDsChronologically,
      configState.uiConfigSequence,
      configState.allUIConfigs
    );

    // Get episodes for current batch
    const currentBatchEpisodes = batchAssignments[currentSequenceElement.batch];
    
    if (!currentBatchEpisodes?.length) {
      if (!advanceToNextStep()) {
        return;
      }
      // Try sampling again with the next step
      await sampleEpisodes();
      return;
    }

    // Find the current UI config
    const currentUIConfig = configState.allUIConfigs.find(
      config => config.id === currentSequenceElement.uiConfig.id
    );

    if (currentUIConfig) {
      // Update active UI config
      configDispatch({
        type: 'SET_ACTIVE_UI_CONFIG',
        payload: currentUIConfig
      });
    }

    // Update active episodes and rankeable episodes
    dispatch({
      type: 'SET_RANKEABLE_EPISODE_IDS',
      payload: currentBatchEpisodes.map(e => IDfromEpisode(e)),
    });

  }, [
    state.selectedExperiment.id,
    state.episodeIDsChronologically,
    state.currentStep,
    configState.uiConfigSequence,
    configState.activeUIConfig,
    configState.allUIConfigs,
    dispatch,
    configDispatch,
    generateBatchAssignments,
    validateBatchSizes,
    advanceToNextStep
  ]);

  return { sampleEpisodes, advanceToNextStep };
};