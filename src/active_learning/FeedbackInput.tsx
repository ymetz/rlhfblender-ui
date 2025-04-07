import React, { useState } from 'react';
import {
  Box,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  Slider,
  TextField,
  Button,
} from '@mui/material';
import { useAppState, useAppDispatch } from '../AppStateContext';

const FeedbackInput = () => {
  const appState = useAppState();
  const dispatch = useAppDispatch();
  const [feedbackType, setFeedbackType] = useState('preference');
  const [feedbackValue, setFeedbackValue] = useState(0);
  const [comment, setComment] = useState('');

  const handleFeedbackTypeChange = (event) => {
    setFeedbackType(event.target.value);
  };

  const handleFeedbackValueChange = (_, newValue) => {
    setFeedbackValue(newValue);
  };

  const handleCommentChange = (event) => {
    setComment(event.target.value);
  };

  const handleSubmitFeedback = async () => {
    // Create a feedback object based on the current state
    const feedback = {
      type: feedbackType,
      value: feedbackValue,
      comment,
      timestamp: new Date().toISOString(),
      sessionId: appState.sessionId,
      experimentId: appState.selectedExperiment?.id || -1,
    };

    // Dispatch the feedback to the app state
    await dispatch({
      type: 'SCHEDULE_FEEDBACK',
      payload: feedback,
    });

    // Reset form
    setFeedbackValue(0);
    setComment('');

    // For demonstration purposes
    console.log('Feedback submitted:', feedback);
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <FormControl component="fieldset" sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Feedback Type
        </Typography>
        <RadioGroup
          row
          name="feedback-type"
          value={feedbackType}
          onChange={handleFeedbackTypeChange}
        >
          <FormControlLabel
            value="preference"
            control={<Radio size="small" />}
            label="Preference"
          />
          <FormControlLabel
            value="correction"
            control={<Radio size="small" />}
            label="Correction"
          />
        </RadioGroup>
      </FormControl>

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Rating
        </Typography>
        <Slider
          value={feedbackValue}
          onChange={handleFeedbackValueChange}
          aria-labelledby="feedback-value-slider"
          valueLabelDisplay="auto"
          step={1}
          marks
          min={-5}
          max={5}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption">Negative</Typography>
          <Typography variant="caption">Positive</Typography>
        </Box>
      </Box>

      <Box sx={{ mb: 2, flex: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Comments
        </Typography>
        <TextField
          multiline
          rows={4}
          fullWidth
          placeholder="Add any additional feedback here..."
          value={comment}
          onChange={handleCommentChange}
          variant="outlined"
          size="small"
        />
      </Box>

      <Button
        variant="contained"
        color="primary"
        onClick={handleSubmitFeedback}
        fullWidth
      >
        Submit Feedback
      </Button>
    </Box>
  );
};

export default FeedbackInput;