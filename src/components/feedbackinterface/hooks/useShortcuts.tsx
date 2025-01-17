import { useEffect, useState, useCallback, useRef } from "react";
import { useShortcuts } from "../../../ShortCutProvider";

export const useFeedbackShortcuts = ({
  episodeIDs,
  feedbackMode,
  onEvalFeedback,
  onBestOfKSelection,
  onDemoRequest,
  onFeatureAnnotation,
  uiConfigFeedbackComponents,
  scheduleFeedback,
  sessionId,
}) => {
  const { registerShortcut, unregisterShortcut } = useShortcuts();
  const [hoveredEpisodeId, setHoveredEpisodeId] = useState(null);
  const [lastInteractedEpisodeId, setLastInteractedEpisodeId] = useState(null);

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

  // Memoize getTargetEpisodeId
  const getTargetEpisodeId = useCallback(() => {
    if (episodeIDs.length === 1) {
      return episodeIDs[0];
    }
    return hoveredEpisodeId || lastInteractedEpisodeId;
  }, [episodeIDs, hoveredEpisodeId, lastInteractedEpisodeId]);

  const handleEpisodeHover = useCallback((episodeId) => {
    setHoveredEpisodeId(episodeId);
    if (episodeId) {
      setLastInteractedEpisodeId(episodeId);
    }
  }, []);

  // Register shortcuts
  useEffect(() => {
    const shortcutIds: string[] = [];

    if (uiConfigFeedbackComponents?.rating) {
      // Register number key shortcuts for ratings
      for (let i = 1; i <= 9; i++) {
        const shortcutId = `rating-${i}`;
        registerShortcut(shortcutId, {
          key: String(i),
          description: `Rate ${i}/9`,
          action: () => {
            const targetId = getTargetEpisodeId();
            if (targetId) {
              callbacksRef.current.onEvalFeedback(targetId, i);
            }
          },
        });
        shortcutIds.push(shortcutId);
      }
    }

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
    getTargetEpisodeId,
    uiConfigFeedbackComponents,
  ]);

  return {
    handleEpisodeHover,
    hoveredEpisodeId,
  };
};

export default useFeedbackShortcuts;
