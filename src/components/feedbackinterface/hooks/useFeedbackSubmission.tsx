import { useCallback } from "react";
import axios from "axios";
import { useAppDispatch } from "../../../AppStateContext";
import { Feedback, FeedbackType } from "../../../types";

export const useFeedbackSubmission = (
  sampleEpisodes: (step: number) => Promise<void>,
  advanceToNextStep: () => Promise<boolean>
) => {
  const dispatch = useAppDispatch();

  const scheduleFeedback = useCallback(
    (feedback: Feedback) => {
      dispatch({ type: "SCHEDULE_FEEDBACK", payload: feedback });
    },
    [dispatch]
  );

  const submitFeedback = useCallback(
    async (scheduledFeedback: Feedback[], sessionId: string) => {
      try {
        // Create submit meta feedback
        const submitFeedback: Feedback = {
          session_id: sessionId,
          feedback_type: FeedbackType.Meta,
          granularity: "entire",
          timestamp: Date.now(),
          meta_action: "submit",
          targets: [],
        };
        
        // Include submit feedback in the payload
        const feedbackToSubmit = [...scheduledFeedback, submitFeedback];
        
        // Submit all feedback to server
        await axios.post("/data/give_feedback", feedbackToSubmit);
        
        // Clear scheduled feedback
        await dispatch({ type: "CLEAR_SCHEDULED_FEEDBACK" });

        // Advance to next step
        const hasNextStep = await advanceToNextStep();
        
        return hasNextStep;
      } catch (error) {
        console.error("Error submitting feedback:", error);
        throw error;
      }
    },
    [dispatch, advanceToNextStep]
  );

  return { scheduleFeedback, submitFeedback };
};