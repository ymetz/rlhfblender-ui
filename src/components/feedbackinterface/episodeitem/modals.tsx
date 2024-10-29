import React from 'react';
import { Dialog } from '@mui/material';
import FeatureHighlightModal from '../feature-highlight-modal';
import CorrectionModal from '../../modals/correction-modal';
import { Feedback } from '../../../types';

interface ModalsProps {
  highlightModalOpen: boolean;
  correctionModalOpen: boolean;
  episodeId: string;
  selectedStep: number;
  videoRef: React.RefObject<HTMLVideoElement>;
  sessionId: string;
  customInput?: any;
  onHighlightClose: () => void;
  onHighlightSubmit: (feedback: Feedback) => void;
  onCorrectionClose: () => void;
  onCorrectionSubmit: (feedback: Feedback, step: number) => void;
  getThumbnailURL?: (episodeId: string) => Promise<string|undefined>;
}

const Modals: React.FC<ModalsProps> = ({
  highlightModalOpen,
  correctionModalOpen,
  episodeId,
  selectedStep,
  videoRef,
  sessionId,
  customInput,
  onHighlightClose,
  onHighlightSubmit,
  onCorrectionClose,
  onCorrectionSubmit,
  getThumbnailURL = async () => undefined,
}) => {
  const getSingleFrame = (video: HTMLVideoElement, time: number): string => {
    if (video === null || video.readyState < 2) {
      return '';
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL();
    }
    return '';
  };

  return (
    <>
      <Dialog open={highlightModalOpen}>
        <FeatureHighlightModal
          episodeId={episodeId}
          getThumbnailURL={getThumbnailURL}
          onClose={onHighlightClose}
          onCloseSubmit={onHighlightSubmit}
          sessionId={sessionId}
        />
      </Dialog>

      <CorrectionModal
        open={correctionModalOpen}
        episodeId={episodeId}
        step={selectedStep}
        frame={videoRef.current ? getSingleFrame(videoRef.current, selectedStep) : ''}
        onClose={onCorrectionClose}
        onCloseSubmit={onCorrectionSubmit}
        custom_input={customInput}
        sessionId={sessionId}
        inputProps={{}}
      />
    </>
  );
};

export default Modals;