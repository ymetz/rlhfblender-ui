import { createContext, useContext } from "react";
import { Episode, FeedbackType } from "./types";

interface ratingInfoContextType {
  isOnSubmit: boolean;
  hasFeedback: (episode: Episode, feedbackType: FeedbackType) => boolean;
}

const RatingInfoContext = createContext<ratingInfoContextType | undefined>(
  undefined,
);

// Used to share rating info across components
const useRatingInfo = () => {
  const context = useContext(RatingInfoContext);
  if (!context) {
    throw new Error("useRatingInfo must be used within ratingInfoProvider");
  }
  return context;
};

export { RatingInfoContext, useRatingInfo };
