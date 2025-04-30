import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Slider,
  Grid,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Alert,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { ThumbDown, ThumbUp } from '@mui/icons-material';
import { useAppState, useAppDispatch } from '../AppStateContext';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import { FeedbackType, Feedback } from '../types';

// Integrated demonstration and corrective components
const DemoGenerator: React.FC<{ targetId: string; onSubmit: (fb: Feedback) => void }> = ({ targetId, onSubmit }) => {
  const [loading, setLoading] = useState(false);
  
  const handleGenerate = async () => {
    setLoading(true);
    // Simulate generation (replace with actual API call)
    setTimeout(() => {
      const fb: Feedback = {
        feedback_type: FeedbackType.Demonstrative,
        targets: [{ target_id: targetId, reference: null as any, origin: 'offline', timestamp: Date.now() }],
        granularity: 'episode',
        timestamp: Date.now(),
        session_id: '' as any
      };
      onSubmit(fb);
      setLoading(false);
    }, 1500);
  };
  
  return (
    <Box sx={{ p: 2, border: '1px dashed', borderRadius: 1, textAlign: 'center' }}>
      <Typography variant="body2" gutterBottom>
        Generate a demonstration starting from this coordinate
      </Typography>
      <Button variant="outlined" onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Demonstration'}
      </Button>
    </Box>
  );
};

// Correction input component
const CorrectionInput: React.FC<{ targetId: string; onSubmit: (text: string) => void }> = ({ targetId, onSubmit }) => {
  const [text, setText] = useState('');
  
  return (
    <Box sx={{ p: 2, border: '1px solid', borderRadius: 1 }}>
      <Typography variant="h6" gutterBottom>State Correction</Typography>
      <TextField
        fullWidth
        multiline
        rows={3}
        placeholder="Describe what the agent should do differently in this state..."
        value={text}
        onChange={e => setText(e.target.value)}
        variant="outlined"
        sx={{ mb: 2 }}
      />
      <Box sx={{ textAlign: 'right' }}>
        <Button
          variant="contained"
          onClick={() => onSubmit(text)}
          disabled={!text.trim()}
        >
          Submit Correction
        </Button>
      </Box>
    </Box>
  );
};

const FeedbackInput = () => {
  const theme = useTheme();
  const { sessionId } = useAppState();
  const appDispatch = useAppDispatch();
  const activeState = useActiveLearningState();
  const activeDispatch = useActiveLearningDispatch();

  const selection = activeState.selection || [];
  const [value, setValue] = useState(5);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Reset state when selection changes
  useEffect(() => {
    setValue(5);
    setChosenId(null);
    setSubmitted(false);
  }, [selection]);

  // Extract selection type and data
  const getSelectionData = () => {
    if (selection.length === 0) return { type: 'none', data: [] };
    if (selection.length === 1) {
      const item = selection[0];
      return { type: item.type, data: [item.data] };
    }
    // For multiple selections, check if all are trajectories
    const allTrajectories = selection.every(item => item.type === 'trajectory');
    if (allTrajectories) {
      return { type: 'multi_trajectory', data: selection.map(item => item.data) };
    }
    return { type: 'mixed', data: selection };
  };

  const selectionData = getSelectionData();

  // Generate target ID based on selection type
  const getId = (selectionType: string, data: any) => {
    switch (selectionType) {
      case 'trajectory':
        return `trajectory_${data}`;
      case 'state':
        return `state_${data[0]}_${data[1]}`;
      case 'cluster':
        return `cluster_${data}`;
      case 'coordinate':
        return `coordinate_${data.x}_${data.y}`;
      default:
        return `unknown_${Date.now()}`;
    }
  };

  const submitFeedback = (fb: Feedback) => {
    appDispatch({ type: 'SCHEDULE_FEEDBACK', payload: fb });
    setSubmitted(true);
    setTimeout(() => activeDispatch({ type: 'SET_SELECTION', payload: [] }), 1500);
  };

  const handleRate = () => {
    const targetId = getId(selectionData.type, selectionData.data[0]);
    const fb: Feedback = {
      feedback_type: FeedbackType.Evaluative,
      targets: [{ target_id: targetId, reference: null as any, origin: 'offline', timestamp: Date.now() }],
      granularity: selectionData.type === 'state' ? 'state' : 'episode',
      timestamp: Date.now(),
      session_id: sessionId,
      score: value
    };
    submitFeedback(fb);
  };

  const handleComparison = () => {
    const ids = selectionData.data.map(data => getId('trajectory', data));
    const fb: Feedback = {
      feedback_type: FeedbackType.Comparative,
      targets: ids.map(id => ({ target_id: id, reference: null as any, origin: 'offline', timestamp: Date.now() })),
      preferences: ids.map(id => id === chosenId ? 1 : 0),
      granularity: 'episode',
      timestamp: Date.now(),
      session_id: sessionId
    };
    submitFeedback(fb);
  };

  const handleCorrect = (text: string) => {
    const targetId = getId(selectionData.type, selectionData.data[0]);
    const fb: Feedback = {
      feedback_type: FeedbackType.Corrective,
      targets: [{ target_id: targetId, reference: null as any, origin: 'offline', timestamp: Date.now() }],
      granularity: 'state',
      timestamp: Date.now(),
      session_id: sessionId,
      correction: text
    };
    submitFeedback(fb);
  };

  // Render different interfaces based on selection type
  const renderFeedbackInterface = () => {
    if (submitted) {
      return <Alert severity="success">Feedback submitted successfully!</Alert>;
    }

    switch (selectionData.type) {
      case 'none':
        return (
          <Typography>
            Select items from the visualization to provide feedback.
          </Typography>
        );

      case 'trajectory':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Rate this trajectory</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
              <ThumbDown 
                sx={{ cursor: 'pointer', mr: 2 }} 
                onClick={() => setValue(v => Math.max(0, v-1))} 
              />
              <Slider
                value={value}
                min={0}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
                onChange={(_, v) => setValue(v as number)}
                sx={{ mx: 2 }}
              />
              <ThumbUp 
                sx={{ cursor: 'pointer', ml: 2 }} 
                onClick={() => setValue(v => Math.min(10, v+1))} 
              />
              <Typography sx={{ ml: 2 }}>{value}/10</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button variant="contained" onClick={handleRate}>
                Submit Rating
              </Button>
            </Box>
          </Box>
        );

      case 'multi_trajectory':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Select the best Episode</Typography>
            <RadioGroup value={chosenId} onChange={e => setChosenId(e.target.value)}>
              <Grid container spacing={2}>
                {selectionData.data.map((trajectoryIdx, i) => {
                  const id = getId('trajectory', trajectoryIdx);
                  return (
                    <Grid item xs={12} key={i}>
                      <FormControlLabel 
                        value={id} 
                        control={<Radio />} 
                        label={`Episode ${trajectoryIdx}`} 
                      />
                    </Grid>
                  );
                })}
              </Grid>
            </RadioGroup>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button 
                variant="contained" 
                onClick={handleComparison} 
                disabled={!chosenId}
              >
                Submit Best Trajectory
              </Button>
            </Box>
          </Box>
        );

      case 'state':
        const stateId = getId(selectionData.type, selectionData.data[0]);
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Provide state correction</Typography>
            <CorrectionInput 
              targetId={stateId} 
              onSubmit={handleCorrect} 
            />
          </Box>
        );

      case 'cluster':
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Rate this cluster of states</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
              <ThumbDown 
                sx={{ cursor: 'pointer', mr: 2 }} 
                onClick={() => setValue(v => Math.max(0, v-1))} 
              />
              <Slider
                value={value}
                min={0}
                max={10}
                step={1}
                marks
                valueLabelDisplay="auto"
                onChange={(_, v) => setValue(v as number)}
                sx={{ mx: 2 }}
              />
              <ThumbUp 
                sx={{ cursor: 'pointer', ml: 2 }} 
                onClick={() => setValue(v => Math.min(10, v+1))} 
              />
              <Typography sx={{ ml: 2 }}>{value}/10</Typography>
            </Box>
            <Typography variant="caption" display="block" sx={{ mb: 2, textAlign: 'center' }}>
              Rating applies to all states in the cluster
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button variant="contained" onClick={handleRate}>
                Submit Cluster Rating
              </Button>
            </Box>
          </Box>
        );

      case 'coordinate':
        const coordinateId = getId(selectionData.type, selectionData.data[0]);
        return (
          <Box>
            <Typography variant="h6" gutterBottom>Generate demonstration from new coordinate</Typography>
            <DemoGenerator 
              targetId={coordinateId} 
              onSubmit={submitFeedback} 
            />
          </Box>
        );

      default:
        return (
          <Typography>
            Unsupported selection type: {selectionData.type}
          </Typography>
        );
    }
  };

  return (
    <Box sx={{ mt: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {renderFeedbackInterface()}
    </Box>
  );
};

export default FeedbackInput;