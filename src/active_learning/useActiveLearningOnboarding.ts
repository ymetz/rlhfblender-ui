import { useCallback, useEffect } from 'react';
import { useOnboarding, createActiveLearningOnboardingSteps } from './OnboardingSystem';
import { useAppState } from '../AppStateContext';

export const useActiveLearningOnboarding = () => {
  const onboarding = useOnboarding();
  const appState = useAppState();

  // Check if conditions are met for onboarding to be available
  const isOnboardingReady = useCallback(() => {

    return !!(
      appState.selectedExperiment &&
      appState.selectedCheckpoint !== -1 &&
      appState.episodeIDsChronologically &&
      appState.episodeIDsChronologically.length > 0
    );
  }, [appState.selectedExperiment, appState.selectedCheckpoint, appState.episodeIDsChronologically]);

  const startActiveLearningTour = useCallback(() => {
    if (!isOnboardingReady()) {
      console.warn('Onboarding not ready - missing selectedExperiment, selectedCheckpoint, or episodeIDsChronologically');
      return;
    }
    
    const steps = createActiveLearningOnboardingSteps();
    onboarding.startOnboarding(steps);
  }, [onboarding, isOnboardingReady]);

  const startOnboardingIfFirstTime = useCallback(() => {
    // Check if user has seen onboarding before and if conditions are met
    const hasSeenOnboarding = false; //localStorage.getItem('activelearning-onboarding-completed');
    
    // Don't start if onboarding is already active
    if (!hasSeenOnboarding && isOnboardingReady() && !onboarding.isActive) {
      // Start onboarding after a short delay to ensure components are mounted
      setTimeout(() => {
        startActiveLearningTour();
      }, 1000);
    }
  }, [startActiveLearningTour, isOnboardingReady, onboarding.isActive]);

  const completeOnboardingPermanently = useCallback(() => {
    onboarding.completeOnboarding();
    localStorage.setItem('activelearning-onboarding-completed', 'true');
  }, [onboarding]);

  const resetOnboarding = useCallback(() => {
    localStorage.removeItem('activelearning-onboarding-completed');
  }, []);

  return {
    ...onboarding,
    startActiveLearningTour,
    startOnboardingIfFirstTime,
    completeOnboardingPermanently,
    resetOnboarding,
    isOnboardingReady,
    triggerStepComplete: onboarding.triggerStepComplete,
  };
};