import { useCallback, useEffect, useRef } from "react";
import axios from "axios";
import { useAppDispatch, useAppState } from "./AppStateContext";
import { useSetupConfigDispatch, useSetupConfigState } from "./SetupConfigContext";
import { IDfromEpisode } from "./id";

export const useConfigBasedSampling = () => {
  const dispatch = useAppDispatch();
  const configDispatch = useSetupConfigDispatch();
  const state = useAppState();
  const configState = useSetupConfigState();
  
  const isProcessing = useRef(false);
  const isInitialized = useRef(false);

  const getCheckpointEpisodePool = useCallback(() => {
    const selectedCheckpointValue = Number(state.selectedCheckpoint);
    if (!Number.isFinite(selectedCheckpointValue) || selectedCheckpointValue < 0) {
      return state.episodeIDsChronologically ?? [];
    }

    const filteredEpisodes = (state.episodeIDsChronologically ?? []).filter(
      (episode) => Number(episode.checkpoint_step) === selectedCheckpointValue,
    );

    return filteredEpisodes.length > 0
      ? filteredEpisodes
      : (state.episodeIDsChronologically ?? []);
  }, [state.episodeIDsChronologically, state.selectedCheckpoint]);

  const isReadyToProgress = useCallback(() => {
    const checkpointEpisodes = getCheckpointEpisodePool();
    return (
      configState.uiConfigSequence?.length > 0 &&
      checkpointEpisodes.length > 0 &&
      state.selectedExperiment.id !== -1
    );
  }, [
    configState.uiConfigSequence,
    state.selectedExperiment.id,
    getCheckpointEpisodePool,
  ]);

  const sampleEpisodes = useCallback(async (stepNumber: number) => {
  
    // If already processing, wait a bit and check again
    if (isProcessing.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (isProcessing.current) {
        return;
      }
    }

    isProcessing.current = true;

    try {
      if (!isReadyToProgress()) {
        return;
      }

      const currentSequenceElement = configState.uiConfigSequence[stepNumber];

      if (!currentSequenceElement) {
        await dispatch({ type: "SET_END_MODAL_OPEN" });
        return;
      }

      const checkpointEpisodes = getCheckpointEpisodePool();
      const currentBatchEpisodes = currentSequenceElement.batch
        .map((index) => checkpointEpisodes[index])
        .filter(Boolean);

      if (!currentBatchEpisodes?.length) {
        return;
      }

      const currentUIConfig = configState.allUIConfigs.find(
        (config) => config.id === currentSequenceElement.uiConfig.id
      );

      if (currentUIConfig) {
        await configDispatch({
          type: "SET_ACTIVE_UI_CONFIG",
          payload: currentUIConfig,
        });
      }

      await dispatch({
        type: "SET_RANKEABLE_EPISODE_IDS",
        payload: currentBatchEpisodes.map((e) => IDfromEpisode(e)),
      });
      
    } catch (error) {
      console.error("Error in sampleEpisodes:", error);
      throw error;
    } finally {
      isProcessing.current = false;
    }
  }, [
    configState.uiConfigSequence,
    configState.allUIConfigs,
    dispatch,
    configDispatch,
    isReadyToProgress,
    getCheckpointEpisodePool,
  ]);

  const advanceToNextStep = useCallback(async () => {

    // Similar processing check as in sampleEpisodes
    if (isProcessing.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (isProcessing.current) {
        return false;
      }
    }

    isProcessing.current = true;

    try {
      if (!isReadyToProgress()) {
        return false;
      }

      const nextStep = state.currentStep + 1;

      // Check if we've reached the end of the sequence
      if (nextStep >= configState.uiConfigSequence.length) {
        await dispatch({ type: "SET_CURRENT_STEP", payload: nextStep });
        await dispatch({ type: "SET_END_MODAL_OPEN" });
        
        try {
          await axios.post(`/data/submit_session?session_id=${state.sessionId}`);
        } catch (error) {
          console.error("Error submitting session:", error);
        }
        return false;
      }

      // Update step first
      await dispatch({ type: "SET_CURRENT_STEP", payload: nextStep });
      
      // Release the processing lock before sampling
      isProcessing.current = false;
      
      // Sample episodes with the new step number
      await sampleEpisodes(nextStep);
      
      return true;
    } catch (error) {
      console.error("Error in advanceToNextStep:", error);
      return false;
    } finally {
      isProcessing.current = false;
    }
  }, [
    state.currentStep,
    state.sessionId,
    configState.uiConfigSequence?.length,
    dispatch,
    isReadyToProgress,
    sampleEpisodes,
  ]);

  // Handle initial loading
  useEffect(() => {
    if (!isInitialized.current && isReadyToProgress()) {
      isInitialized.current = true;
      sampleEpisodes(0); // Start with step 0
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
