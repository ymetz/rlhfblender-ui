import { useEffect, useState, useCallback, useRef } from "react";
import { useShortcuts } from "../../../ShortCutProvider";


type FeedbackShortcutProps = {
  episodeIDs: (string | number)[];
  feedbackMode: "ranking" | "bestOfK" | "annotation";
  onEvalFeedback: (episodeId: string, rating: number) => void;
  onBestOfKSelection: (episodeId: string) => void;
  onDemoRequest?: (episodeId: string) => void;
  onFeatureAnnotation?: (episodeId: string, feature: string) => void;
  uiConfigFeedbackComponents: {
    rating?: boolean;
    ranking?: boolean;
    annotation?: boolean;
  };
  scheduleFeedback?: boolean;
  sessionId?: string;
};

export const useFeedbackShortcuts = (props: FeedbackShortcutProps) => {
  const { registerShortcut, unregisterShortcut } = useShortcuts();
  const [hoveredEpisodeId, setHoveredEpisodeId] = useState<string | number | null>(null);
  const [lastInteractedEpisodeId, setLastInteractedEpisodeId] = useState<string | number | null>(null);

  // Use refs to store callback functions
  const callbacksRef = useRef({
    onEvalFeedback: props.onEvalFeedback,
    onBestOfKSelection: props.onBestOfKSelection,
    onDemoRequest: props.onDemoRequest,
    onFeatureAnnotation: props.onFeatureAnnotation,
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onEvalFeedback: props.onEvalFeedback,
      onBestOfKSelection: props.onBestOfKSelection,
      onDemoRequest: props.onDemoRequest,
      onFeatureAnnotation: props.onFeatureAnnotation,
    };
  }, [props.onEvalFeedback, props.onBestOfKSelection, props.onDemoRequest, props.onFeatureAnnotation]);

  // Memoize getTargetEpisodeId
  const getTargetEpisodeId = useCallback(() => {
    if (props.episodeIDs.length === 1) {
      return props.episodeIDs[0];
    }
    return hoveredEpisodeId || lastInteractedEpisodeId;
  }, [props.episodeIDs, hoveredEpisodeId, lastInteractedEpisodeId]);
  const handleEpisodeHover = useCallback((episodeId: string | number) => {
    setHoveredEpisodeId(episodeId);
    if (episodeId) {
      setLastInteractedEpisodeId(episodeId);
    }
  }, []);

  // Register shortcuts
  useEffect(() => {
    const shortcutIds: string[] = [];

    if (props.uiConfigFeedbackComponents?.rating) {
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

    if (props.uiConfigFeedbackComponents?.ranking && props.feedbackMode === "bestOfK") {
      ["left", "right"].forEach((direction, index) => {
        const shortcutId = `select-${direction}`;
        registerShortcut(shortcutId, {
          key: direction === "left" ? "ArrowLeft" : "ArrowRight",
          description: `Select ${direction} episode`,
          action: () => {
            if (props.episodeIDs.length === 2) {
              callbacksRef.current.onBestOfKSelection(props.episodeIDs[index]);
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
    props.feedbackMode,
    props.episodeIDs,
    getTargetEpisodeId,
    props.uiConfigFeedbackComponents,
  ]);

  return {
    handleEpisodeHover,
    hoveredEpisodeId,
  };
};

export default useFeedbackShortcuts;
