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

  const isReadyToProgress = useCallback(() => {
    return (
      configState.uiConfigSequence?.length > 0 &&
      state.episodeIDsChronologically?.length > 0 &&
      state.selectedExperiment.id !== -1
    );
  }, [
    configState.uiConfigSequence,
    state.episodeIDsChronologically,
    state.selectedExperiment.id,
  ]);

  const sampleEpisodes = useCallback(async (stepNumber: number) => {
    console.log("SAMPLE EPISODES with step", stepNumber, "processing:", isProcessing.current);
    
    // If already processing, wait a bit and check again
    if (isProcessing.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (isProcessing.current) {
        console.log("Still processing, skipping");
        return;
      }
    }

    isProcessing.current = true;
    console.log("Starting processing for step", stepNumber);

    try {
      if (!isReadyToProgress()) {
        console.log("Not ready to progress");
        return;
      }

      const currentSequenceElement = configState.uiConfigSequence[stepNumber];

      if (!currentSequenceElement) {
        await dispatch({ type: "SET_END_MODAL_OPEN" });
        return;
      }

      const currentBatchEpisodes = currentSequenceElement.batch.map(
        (index) => state.episodeIDsChronologically[index]
      );

      if (!currentBatchEpisodes?.length) {
        console.log("No episodes for batch");
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
      
      console.log("Successfully sampled episodes for step", stepNumber);
    } catch (error) {
      console.error("Error in sampleEpisodes:", error);
      throw error;
    } finally {
      console.log("Resetting processing flag");
      isProcessing.current = false;
    }
  }, [
    state.episodeIDsChronologically,
    configState.uiConfigSequence,
    configState.allUIConfigs,
    dispatch,
    configDispatch,
    isReadyToProgress,
  ]);

  const advanceToNextStep = useCallback(async () => {
    console.log("Advancing to next step, processing:", isProcessing.current);
    
    // Similar processing check as in sampleEpisodes
    if (isProcessing.current) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (isProcessing.current) {
        console.log("Still processing in advanceToNextStep");
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
          await axios.post("/data/submit_session", {
            sessionId: state.sessionId,
          });
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