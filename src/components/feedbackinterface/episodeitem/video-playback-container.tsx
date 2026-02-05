// video-playback-container.tsx
import React, { useState, useEffect, useCallback } from "react";
import EnvRender from "./env-render";
import TimelineSection from "./timeline-section";

interface VideoPlaybackContainerProps {
  episodeID: string;
  videoURL: string;
  rewards: number[];
  uncertainty: number[];
  actions: number[];
  actionLabels: any[];
  mission?: string;
  onCorrectionClick: (step: number) => void;
  givenFeedbackMarkers: any[];
  proposedFeedbackMarkers: any[];
  hasCorrectiveFeedback: boolean;
  hasFeatureSelectionFeedback: boolean;
  showFeatureSelection: boolean;
  onFeatureSelect: () => void;
  useCorrectiveFeedback: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const VideoPlaybackContainer: React.FC<VideoPlaybackContainerProps> = React.memo(({
  videoURL,
  rewards,
  uncertainty,
  actions,
  actionLabels,
  mission,
  onCorrectionClick,
  givenFeedbackMarkers,
  proposedFeedbackMarkers,
  hasCorrectiveFeedback,
  hasFeatureSelectionFeedback,
  showFeatureSelection,
  onFeatureSelect,
  useCorrectiveFeedback,
  videoRef,
}) => {
  // Local state for video playback - isolated from parent component
  const [playing, setPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoSliderValue, setVideoSliderValue] = useState(0);
  
  // Reset playback state when video URL changes
  useEffect(() => {
    setPlaying(false);
    setVideoSliderValue(0);
    // Don't reset duration here - let it update on metadata load
  }, [videoURL]);

  // Handle video playback state
  useEffect(() => {
    if (!playing) return;
    
    const interval = setInterval(() => {
      if (videoRef.current) {
        // Only update if the time has actually changed
        const currentTime = videoRef.current.currentTime;
        if (!Number.isNaN(currentTime) && Math.abs(currentTime - videoSliderValue) > 0.01) {
          setVideoSliderValue(currentTime);
        }
      }
    }, 16); // ~60fps update rate
    
    return () => clearInterval(interval);
  }, [playing, videoRef, videoSliderValue]);

  // Memoized handlers to prevent recreation on each render
  const onLoadMetaDataHandler = useCallback(() => {
    if (videoRef.current) {
      setVideoDuration(videoRef.current.duration);
    }
  }, [videoRef]);

  const playButtonHandler = useCallback(() => {
    if (!videoRef.current) return;
    
    if (playing) {
      videoRef.current.pause();
      setPlaying(false);
    } else {
      // Handle possible video ended state
      if (videoRef.current.ended || videoRef.current.currentTime >= videoDuration - 0.1) {
        videoRef.current.currentTime = 0;
      }
      
      videoRef.current.play()
        .then(() => setPlaying(true))
        .catch(err => {
          console.error("Could not play video:", err);
          setPlaying(false);
        });
    }
  }, [playing, videoRef, videoDuration]);

  const videoSliderHandler = useCallback((value: number | number[]) => {
    if (!videoRef.current) return;
    
    const newTime = Number.isNaN(value) ? 0 : (value as number);
    
    // Only update if the difference is significant
    if (Math.abs(videoRef.current.currentTime - newTime) > 0.01) {
      videoRef.current.currentTime = newTime;
      setVideoSliderValue(newTime);
    }
  }, [videoRef]);

  return (
    <>
      {/* We preserve the original gridArea layout */}
      <EnvRender
        videoRef={videoRef}
        videoURL={videoURL}
        onLoadMetadata={onLoadMetaDataHandler}
        hasFeatureSelectionFeedback={hasFeatureSelectionFeedback}
        showFeatureSelection={showFeatureSelection}
        onFeatureSelect={onFeatureSelect}
        playButtonHandler={playButtonHandler}
        videoSliderHandler={videoSliderHandler}
        playing={playing}
        mission={mission}
      />
      
      <TimelineSection
        rewards={rewards}
        uncertainty={uncertainty}
        actions={actions}
        actionLabels={actionLabels}
        videoDuration={videoDuration}
        videoSliderValue={videoSliderValue}
        givenFeedbackMarkers={givenFeedbackMarkers}
        proposedFeedbackMarkers={proposedFeedbackMarkers}
        onSliderChange={videoSliderHandler}
        onCorrectionClick={onCorrectionClick}
        hasCorrectiveFeedback={hasCorrectiveFeedback}
        useCorrectiveFeedback={useCorrectiveFeedback}
      />
    </>
  );
});

export default VideoPlaybackContainer;