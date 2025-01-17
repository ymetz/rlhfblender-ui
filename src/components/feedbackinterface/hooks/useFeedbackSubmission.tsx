import { useCallback } from "react";
import axios from "axios";
import { useAppDispatch } from "../../../AppStateContext";
import { Feedback } from "../../../types";

export const useFeedbackSubmission = (
  sampleEpisodes: () => Promise<void>,
  advanceToNextStep: () => Promise<boolean>,
) => {
  const dispatch = useAppDispatch();

  const scheduleFeedback = useCallback(
    (feedback: Feedback) => {
      dispatch({ type: "SCHEDULE_FEEDBACK", payload: feedback });
    },
    [dispatch],
  );

  const submitFeedback = useCallback(
    async (scheduledFeedback: Feedback[]) => {
      try {
        // Submit feedback to server
        await axios.post("/data/give_feedback", scheduledFeedback);

        // Clear scheduled feedback before proceeding
        await dispatch({ type: "CLEAR_SCHEDULED_FEEDBACK" });

        // Try to advance to next step
        const hasNextStep = await advanceToNextStep();

        // Only sample new episodes if we successfully advanced
        if (hasNextStep) {
          await sampleEpisodes();
        }
      } catch (error) {
        console.error("Error submitting feedback:", error);
        // Optionally re-throw the error if you want to handle it in the UI
        throw error;
      }
    },
    [dispatch, advanceToNextStep, sampleEpisodes],
  );

  return { scheduleFeedback, submitFeedback };
};
