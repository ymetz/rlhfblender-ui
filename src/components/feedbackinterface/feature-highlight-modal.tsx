import React, {useState, useEffect, useRef} from 'react';
import {ReactSketchCanvas, ReactSketchCanvasRef} from 'react-sketch-canvas';
import Box from '@mui/material/Box';
import Close from '@mui/icons-material/Close';
import Redo from '@mui/icons-material/Redo';
import Undo from '@mui/icons-material/Undo';
import Delete from '@mui/icons-material/Delete';
import Send from '@mui/icons-material/Send';
import Tooltip from '@mui/material/Tooltip';
import axios from 'axios';
import {Feedback, FeedbackType} from '../../types';
import {EpisodeFromID} from '../../id';

interface FeatureHighlightModalProps {
  episodeId: string;
  getThumbnailURL: (episodeId: string) => Promise<string | undefined>;
  onClose: () => void;
  onCloseSubmit: (feedback: Feedback) => void;
  sessionId: string;
}

const FeatureHighlightModal: React.FC<FeatureHighlightModalProps> = ({
  episodeId,
  getThumbnailURL,
  onClose,
  onCloseSubmit,
  sessionId,
}) => {
  const canvasRef = useRef<ReactSketchCanvasRef>(null);

  const [thumbnailURL, setThumbnailURL] = useState('');
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);

  useEffect(() => {
    getThumbnailURL(episodeId).then(url => {
      if (url !== undefined) {
        // Get natural height and width of the image
        const img = new Image();
        img.src = url;
        img.onload = () => {
          setImageWidth(350);
          setImageHeight(350);
          setThumbnailURL(url);
        };
      }
    });
  }, [episodeId, getThumbnailURL, thumbnailURL]);

  const onSubmitFeedback = () => {
    // Hack to prevent background image from being exported
    const oldURL = thumbnailURL;
    setThumbnailURL('0');

    canvasRef.current
      ?.exportImage('png')
      .then(data => {
        // Create a FormData object to send the image file
        const file = new File([data], 'image.png', {type: 'image/png'});

        const formData = new FormData();
        formData.append('image', file);

        const save_image_name = ("feature_selection_" + sessionId + "_" + episodeId).replace(/[^a-zA-Z0-9]/g, "_");

        const feedback = {
          feedback_type: FeedbackType.FeatureSelection,
          targets: [
            {
              target_id: episodeId,
              reference: EpisodeFromID(episodeId),
              origin: 'offline',
              timestamp: Date.now(),
            },
          ],
          granularity: 'entire',
          timestamp: Date.now(),
          session_id: sessionId,
          feature_selection: save_image_name, 
        } as Feedback;
        axios.post('/data/give_feedback', feedback).catch(error => {
          console.log(error);
        });
  
        // Send the image data to the backend using Axios (also send the sessionID)
        axios({
          method: 'post',
          url: '/data/save_feature_feedback?save_image_name=' + save_image_name,
          data: formData,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'multipart/form-data',
          },
        })
          .then(response => {
            console.log('Image saved successfully:', response.data);
          })
          .catch(error => {
            console.log('Error saving image:', error);
          });
      })
      .catch(e => {
        console.log('Error exporting image:', e);
      });

    onCloseSubmit({
      feedback_type: FeedbackType.FeatureSelection,
      targets: [
        {
          target_id: episodeId,
          reference: EpisodeFromID(episodeId),
          origin: 'offline',
          timestamp: Date.now(),
        },
      ],
      granularity: 'entire',
      timestamp: Date.now(),
      session_id: sessionId,
    } as Feedback);

    onClose();
  };

  return (
    <Box>
      <ReactSketchCanvas
        ref={canvasRef}
        style={{
          width: imageWidth,
          height: imageHeight,
        }}
        strokeWidth={imageHeight / 10}
        strokeColor="rgba(255,255,0,0.5)"
        backgroundImage={thumbnailURL}
      />
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          width: 'auto',
        }}
      >
        <Tooltip title="Submit Feedback">
          <Send
            onClick={onSubmitFeedback}
            style={{
              color: 'green',
            }}
          />
        </Tooltip>
        <Tooltip title="Undo last action">
          <Undo
            onClick={() => canvasRef.current?.undo()}
            style={{
              color: 'white',
            }}
          />
        </Tooltip>
        <Tooltip title="Redo last action">
          <Redo
            onClick={() => canvasRef.current?.redo()}
            style={{
              color: 'white',
            }}
          />
        </Tooltip>
        <Tooltip title="Clear canvas">
          <Delete
            onClick={() => canvasRef.current?.clearCanvas()}
            style={{
              color: 'white',
            }}
          />
        </Tooltip>
        <Tooltip title="Exit (Changes not saved)">
          <Close
            onClick={onClose}
            style={{
              color: 'white',
            }}
          />
        </Tooltip>
      </Box>
    </Box>
  );
};

export default FeatureHighlightModal;
