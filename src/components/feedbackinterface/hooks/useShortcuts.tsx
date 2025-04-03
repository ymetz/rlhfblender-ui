import { useEffect, useState, useRef } from "react";
import { useShortcuts } from "../../../ShortCutProvider";

export const useFeedbackShortcuts = ({
  episodeIDs,
  feedbackMode,
  onEvalFeedback,
  onBestOfKSelection,
  onDemoRequest,
  onFeatureAnnotation,
  uiConfigFeedbackComponents,
}) => {
  const { registerShortcut, unregisterShortcut } = useShortcuts();

  // Use refs to store callback functions
  const callbacksRef = useRef({
    onEvalFeedback,
    onBestOfKSelection,
    onDemoRequest,
    onFeatureAnnotation,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onEvalFeedback,
      onBestOfKSelection,
      onDemoRequest,
      onFeatureAnnotation,
    };
  }, [onEvalFeedback, onBestOfKSelection, onDemoRequest, onFeatureAnnotation]);


  // Register shortcuts
  useEffect(() => {
    const shortcutIds: string[] = [];

    if (uiConfigFeedbackComponents?.ranking && feedbackMode === "bestOfK") {
      ["left", "right"].forEach((direction, index) => {
        const shortcutId = `select-${direction}`;
        registerShortcut(shortcutId, {
          key: direction === "left" ? "ArrowLeft" : "ArrowRight",
          description: `Select ${direction} episode`,
          action: () => {
            if (episodeIDs.length === 2) {
              callbacksRef.current.onBestOfKSelection(episodeIDs[index]);
            }
          },
        });
        shortcutIds.push(shortcutId);
      });
    }

    // Clean up function to unregister all shortcuts
    return () => {
      shortcutIds.forEach((id) => unregisterShortcut(id));
    };
  }, [
    registerShortcut,
    unregisterShortcut,
    feedbackMode,
    episodeIDs,
    uiConfigFeedbackComponents,
  ]);
};

export default useFeedbackShortcuts;
