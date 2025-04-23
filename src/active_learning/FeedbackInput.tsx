import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Slider,
  Grid,
  Card,
  CardContent,
  CardActionArea,
  FormControlLabel,
  Radio,
  RadioGroup,
  TextField,
  Paper,
  Alert
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { Check, ThumbDown, ThumbUp } from '@mui/icons-material';
import chroma from 'chroma-js';
import { useAppState, useAppDispatch } from '../AppStateContext';
import { useActiveLearningState, useActiveLearningDispatch } from '../ActiveLearningContext';
import { FeedbackType, Feedback } from '../types';

// Integrated demonstration and corrective components (replace modals)
const DemoGenerator: React.FC<{ targetId: string; onSubmit: (fb: Feedback) => void }> = ({ targetId, onSubmit }) => {
  const [loading, setLoading] = useState(false);
  // placeholder: call API to generate demo, then dispatch feedback
  const handleGenerate = async () => {
    setLoading(true);
    // simulate generation
    const fb: Feedback = {
      feedback_type: FeedbackType.Demonstrative,
      targets: [{ target_id: targetId, reference: null as any, origin: 'offline', timestamp: Date.now() }],
      granularity: 'episode',
      timestamp: Date.now(),
      session_id: '' as any
    };
    onSubmit(fb);
    setLoading(false);
  };
  return (
    <Box sx={{ p: 1, border: '1px dashed', borderRadius: 1, textAlign: 'center' }}>
      <Button variant="outlined" onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Demonstration'}
      </Button>
    </Box>
  );
};

// Correction input integrated
const CorrectionInput: React.FC<{ targetId: string; onSubmit: (text: string) => void }> = ({ targetId, onSubmit }) => {
  const [text, setText] = useState('');
  return (
    <Box sx={{ p: 2, border: '1px solid', borderRadius: 1 }}>
      <Typography variant="h6" gutterBottom>Correction</Typography>
      <TextField
        fullWidth
        multiline
        rows={3}
        placeholder="Describe correction..."
        value={text}
        onChange={e => setText(e.target.value)}
        variant="outlined"
      />
      <Box sx={{ mt: 1, textAlign: 'right' }}>
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

const FeedbackInterface = () => {
  const theme = useTheme();
  const { selection, sessionId } = useAppState();
  const appDispatch = useAppDispatch();
  const activeState = useActiveLearningState();
  const activeDispatch = useActiveLearningDispatch();

  const selected = activeState.selection || [];
  const [value, setValue] = useState(5);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setValue(5);
    setChosenId(null);
    setSubmitted(false);
  }, [selected]);

  const getType = () => {
    if (selected.length === 0) return 'none';
    if (selected.length === 1) return 'single';
    return 'multi';
  };

  const getId = () => `${selected[0]?.env_name}_${selected[0]?.checkpoint_step}_${selected[0]?.episode_num}`;

  const submitFeedback = (fb: Feedback) => {
    appDispatch({ type: 'SCHEDULE_FEEDBACK', payload: fb });
    setSubmitted(true);
    setTimeout(() => activeDispatch({ type: 'SET_SELECTION', payload: [] }), 1500);
  };

  const handleRate = () => {
    const fb: Feedback = {
      feedback_type: FeedbackType.Evaluative,
      targets: [{ target_id: getId(), reference: null as any, origin: 'offline', timestamp: Date.now() }],
      granularity: 'episode',
      timestamp: Date.now(),
      session_id: sessionId,
      score: value
    };
    submitFeedback(fb);
  };

  const handleBest = () => {
    const ids = selected.map(ep => getId());
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
    const fb: Feedback = {
      feedback_type: FeedbackType.Corrective,
      targets: [{ target_id: getId(), reference: null as any, origin: 'offline', timestamp: Date.now() }],
      granularity: 'state',
      timestamp: Date.now(),
      session_id: sessionId,
      correction: text
    };
    submitFeedback(fb);
  };

  const render = () => {
    const type = getType();
    if (type === 'none') return <Typography>Select items...</Typography>;
    if (submitted) return <Alert severity="success">Submitted!</Alert>;

    if (type === 'single') {
      return (
        <Box>
          <Typography>Rate this episode</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
            <ThumbDown onClick={() => setValue(v => Math.max(0, v-1))} />
            <Slider
              value={value}
              min={0}
              max={10}
              onChange={(_, v) => setValue(v as number)}
              sx={{ mx:2 }}
            />
            <ThumbUp onClick={() => setValue(v => Math.min(10, v+1))} />
          </Box>
          <Box sx={{ display:'flex', gap:1 }}>
            <Button variant="contained" onClick={handleRate}>Submit Rating</Button>
            <DemoGenerator targetId={getId()} onSubmit={submitFeedback} />
            { getId().includes('state_') && <CorrectionInput targetId={getId()} onSubmit={handleCorrect} /> }
          </Box>
        </Box>
      );
    }
    // multi
    return (
      <Box>
        <Typography>Select best</Typography>
        <RadioGroup value={chosenId} onChange={e=>setChosenId(e.target.value)}>
          <Grid container spacing={2}>
            {selected.map((ep,i)=>(
              <Grid item key={i}>
                <FormControlLabel value={getId()} control={<Radio />} label={`#${ep.episode_num}`} />
              </Grid>
            ))}
          </Grid>
        </RadioGroup>
        <Button onClick={handleBest} disabled={!chosenId}>Submit Best</Button>
      </Box>
    );
  };

  return <Box sx={{ mt:4 }}>{render()}</Box>;
};

export default FeedbackInterface;
