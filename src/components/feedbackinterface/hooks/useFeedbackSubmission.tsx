import { useCallback } from 'react';
import axios from 'axios';
import { useAppDispatch, useAppState } from '../../../AppStateContext';
import { Feedback } from '../../../types';

export const useFeedbackSubmission = (sampleEpisodes: () => Promise<void>, advanceToNextStep: () => boolean) => {
  const dispatch = useAppDispatch();
  const state = useAppState();

  const scheduleFeedback = useCallback((feedback: Feedback) => {
    dispatch({ type: 'SCHEDULE_FEEDBACK', payload: feedback });
  }, [dispatch, state.scheduledFeedback]);

  const submitFeedback = useCallback(async (scheduledFeedback: Feedback[]) => {
    try {
      axios.post('/data/give_feedback', scheduledFeedback);

      // Clear scheduled feedback
      dispatch({ type: 'CLEAR_SCHEDULED_FEEDBACK' });

      // Advance to next step and sample new episodes
      const hasNextStep = advanceToNextStep();
      if (hasNextStep) {
        await sampleEpisodes();
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  }, [dispatch, state.sessionId, advanceToNextStep, sampleEpisodes]);

  return { scheduleFeedback, submitFeedback };
};