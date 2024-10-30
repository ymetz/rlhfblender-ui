import * as React from 'react';

// MUI components
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select, {SelectChangeEvent} from '@mui/material/Select';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Checkbox from '@mui/material/Checkbox';
import {MuiFileInput} from 'mui-file-input';
import {FormControl, InputLabel, MenuItem, Stack} from '@mui/material';
import UploadIcon from '@mui/icons-material/Upload';

// A list of all available custom inputs
import {AvailableCustomInputs} from '../../custom_env_inputs/custom_input_mapping';

// Our types
import {UIConfig, BackendConfig} from '../../types';

export type ConfigModalProps = {
  config: UIConfig | BackendConfig;
  open: boolean;
  onClose: (newConfig: null | UIConfig | BackendConfig) => void;
};

export default function ConfigModal(props: ConfigModalProps) {
  /* Dynamically create a form based on the config object */
  const config: UIConfig | BackendConfig = props.config;

  const availableCustomInputs = AvailableCustomInputs();

  // Copy the config object, make it mutable and addressable as state,
  const [new_config, setNewConfig] = React.useState(Object.assign({}, config));
  const [filePath, setFilePath] = React.useState(null as File | null);

  const handleChange = (newValue: File | null) => {
    setFilePath(newValue);
  };

  const upload = () => {
    if (filePath === null) {
      return;
    }
    const reader = new FileReader();
    reader.onload = event => {
      const config = JSON.parse(event.target?.result as string);
      setNewConfig(config);
    };
    reader.readAsText(filePath);
  };

  const formChangeHandler = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const overwrite_config = Object.assign({}, new_config);
    const value = event.target.value;
    // @ts-ignore
    overwrite_config[event.target?.id] = value;
    setNewConfig(overwrite_config);
  };

  const formChangeHandlerCheckbox = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const overwrite_config = Object.assign({}, new_config);
    const key = event.target.id.split('_')[0];
    const component = event.target.id.split('_')[1];
    const value = event.target.checked;
    // @ts-ignore
    overwrite_config[key as keyof UIConfig][component] = value;
    setNewConfig(overwrite_config);
  };

  const formDropdownHandler = (event: SelectChangeEvent<string>) => {
    const overwrite_config = Object.assign({}, new_config);
    const value = event.target.value as string;
    overwrite_config.customInput = value;
    setNewConfig(overwrite_config);
  };

  return (
    <div>
      <Dialog open={props.open} onClose={() => props.onClose(null)}
      PaperProps={{ style: {
        minHeight: '50%',
        maxHeight: '50%',
      }}} >
        <DialogTitle>RLHF-Blender: Experiment Setup</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Create a new experiment configuration.
          </DialogContentText>
          <hr />
          <DialogContentText>
            Upload a config file to copy the settings from an existing
            experiment.
          </DialogContentText>
          <Stack direction={'row'}>
            <MuiFileInput
              value={filePath}
              onChange={handleChange}
              sx={{width: '80%', marginRight: '10px'}}
            />
            <Button
              variant="outlined"
              startIcon={<UploadIcon />}
              onClick={() => upload()}
            >
              Upload
            </Button>
          </Stack>
          <DialogContentText>
            Adapt the settings below to your needs.
          </DialogContentText>
          {Object.keys(new_config).map((key: string, index: number) => {
            if (key === 'id' || key === 'customInput') {
              return <div></div>;
            } else if (key === 'uiComponents' || key === 'feedbackComponents') {
              return (
                <div key={index}>
                  <DialogContentText>
                    Choose which {key} to include in the experiment.
                  </DialogContentText>
                  <FormGroup>
                    {Object.keys(new_config[key as keyof UIConfig]).map(
                      (component: string) => {
                        const element =
                          new_config[key][
                            component as keyof UIConfig[typeof key]
                          ];
                        return (
                          <div>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  id={key + '_' + component}
                                  onChange={formChangeHandlerCheckbox}
                                  checked={element}
                                />
                              }
                              label={component}
                            />
                          </div>
                        );
                      }
                    )}
                  </FormGroup>
                </div>
              );
            } else if (
              typeof new_config[key as keyof UIConfig] === 'string'
            ) {
              return (
                <TextField
                  margin="dense"
                  id={key}
                  label={key}
                  type="text"
                  fullWidth
                  value={new_config[key as keyof UIConfig]}
                  onChange={formChangeHandler}
                />
              );
            } else if (
              typeof new_config[key as keyof UIConfig] === 'number'
            ) {
              return (
                <TextField
                  margin="dense"
                  id={key}
                  label={key}
                  type="number"
                  fullWidth
                  value={new_config[key as keyof UIConfig]}
                  onChange={formChangeHandler}
                />
              );
            } else {
              return <div></div>;
            }
          })}
          <FormControl fullWidth margin="dense">
            <InputLabel id="custom-environment-input-label">
              Custom Environment Input
            </InputLabel>
            <Select
              id="customInput"
              labelId="custom-environment-input-label"
              value={'customInput' in new_config ? new_config.customInput : ''}
              onChange={formDropdownHandler}
            >
              {availableCustomInputs.map((element: string) => {
                return <MenuItem value={element}>{element}</MenuItem>;
              })}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => props.onClose(null)}>Cancel</Button>
          <Button onClick={() => props.onClose(new_config)}>Add Config</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
