import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Alert,
  Checkbox,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import { SelectChangeEvent } from '@mui/material/Select';
import axios from 'axios';
import { useAppState } from '../../AppStateContext';

interface Environment {
  registration_id: string;
  env_name: string;
  description: string;
}

interface DynamicRLHFModalProps {
  open: boolean;
  onClose: () => void;
  onTrainingStarted: (sessionData: any) => void;
}

const DynamicRLHFModal: React.FC<DynamicRLHFModalProps> = ({
  open,
  onClose,
  onTrainingStarted,
}) => {
  const state = useAppState();
  const [experimentName, setExperimentName] = useState('');
  const [selectedEnvironment, setSelectedEnvironment] = useState('');
  const [selectedCloneExperiment, setSelectedCloneExperiment] = useState('');
  const [useCloning, setUseCloning] = useState(true);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load environments when modal opens
  useEffect(() => {
    if (open) {
      loadEnvironments();
    }
  }, [open]);

  const loadEnvironments = async () => {
    try {
      const response = await axios.get('/get_all?model_name=environment');
      setEnvironments(response.data);
    } catch (error) {
      console.error('Error loading environments:', error);
      setError('Failed to load environments');
    }
  };

  const handleStartTraining = async () => {
    if (!experimentName) {
      setError('Please provide experiment name');
      return;
    }

    if (!useCloning && !selectedEnvironment) {
      setError('Please select an environment when not cloning');
      return;
    }

    if (useCloning && !selectedCloneExperiment) {
      setError('Please select an experiment to clone');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const requestData = {
        num_iterations: 5, // Default value for now
        experiment_name: experimentName,
        environment_id: useCloning ? null : selectedEnvironment,
        clone_from_experiment: useCloning ? selectedCloneExperiment : null,
      };

      const response = await axios.post('/dynamic_rlhf/start_dynamic_rlhf_training', requestData);
      
      if (response.data.status === 'success') {
        const sessionData = response.data;
        setSuccess(`Training started successfully! Session ID: ${sessionData.session_id}`);
        
        // Automatically trigger initial data collection (phase 0)
        try {
          setSuccess(`Collecting initial trajectories...`);
          
          const iterationResponse = await axios.post(
            `/dynamic_rlhf/train_iteration?session_id=${sessionData.session_id}&experiment_id=${sessionData.experiment_id}&phase=0`
          );
          
          if (iterationResponse.data.phaseStatus === 'training_started') {
            setSuccess(`Initial data collection completed! Collected ${iterationResponse.data.trajectories_saved} trajectories.`);
          } else {
            console.warn('Initial data collection response:', iterationResponse.data);
            setSuccess(`Training started successfully! Session ID: ${sessionData.session_id}`);
          }
        } catch (iterationError: any) {
          console.error('Error in initial data collection:', iterationError);
          // Don't fail the whole process if initial collection fails
          setSuccess(`Training started, but initial data collection failed: ${iterationError.response?.data?.message || iterationError.message}`);
        }
        
        onTrainingStarted(sessionData);
        setTimeout(() => {
          onClose();
          resetForm();
        }, 3000); // Increased timeout to show the success message longer
      } else {
        setError(response.data.message || 'Failed to start training');
      }
    } catch (error: any) {
      console.error('Error starting training:', error);
      setError(error.response?.data?.message || 'Failed to start training');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setExperimentName('');
    setSelectedEnvironment('');
    setSelectedCloneExperiment('');
    setUseCloning(false);
    setError('');
    setSuccess('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Typography variant="h6">Start DynamicRLHF Training</Typography>
        <Typography variant="body2" color="text.secondary">
          Create a new experiment and start human-in-the-loop training
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          
          {success && (
            <Alert severity="success" onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          <TextField
            label="Experiment Name"
            value={experimentName}
            onChange={(e) => setExperimentName(e.target.value)}
            fullWidth
            required
            placeholder="Enter a unique experiment name"
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={useCloning}
                onChange={(e) => setUseCloning(e.target.checked)}
              />
            }
            label="Clone from existing experiment (recommended)"
          />

          {useCloning ? (
            <FormControl fullWidth required>
              <InputLabel>Clone from Experiment</InputLabel>
              <Select
                value={selectedCloneExperiment}
                onChange={(e: SelectChangeEvent) => setSelectedCloneExperiment(e.target.value)}
                label="Clone from Experiment"
              >
                {state.experiments.map((exp) => (
                  <MenuItem key={exp.id} value={exp.exp_name}>
                    {exp.exp_name} ({exp.env_id}) - {exp.framework}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <FormControl fullWidth required>
              <InputLabel>Environment</InputLabel>
              <Select
                value={selectedEnvironment}
                onChange={(e: SelectChangeEvent) => setSelectedEnvironment(e.target.value)}
                label="Environment"
              >
                {environments.map((env) => (
                  <MenuItem key={env.registration_id} value={env.registration_id}>
                    {env.env_name} ({env.registration_id})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Typography variant="body2" color="text.secondary">
            This will create a new experiment and start a DynamicRLHF training session.
            The training will use human feedback collected through the interface.
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleStartTraining}
          variant="contained"
          disabled={loading || !experimentName || (useCloning ? !selectedCloneExperiment : !selectedEnvironment)}
          startIcon={loading ? <CircularProgress size={20} /> : undefined}
        >
          {loading ? 'Starting...' : 'Start Training'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DynamicRLHFModal;