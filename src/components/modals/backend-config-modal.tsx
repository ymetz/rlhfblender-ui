import * as React from "react";

// MUI components
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Chip from "@mui/material/Chip";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import { MuiFileInput } from "mui-file-input";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import { BackendConfigSequenceVisualizer } from "./backend-config-sequence-generator";
import UploadIcon from "@mui/icons-material/Upload";
import OutlinedInput from "@mui/material/OutlinedInput";

// Our types
import { BackendConfig, UIConfig } from "../../types";

export type ConfigModalProps = {
  config: BackendConfig;
  uiConfigList: UIConfig[];
  open: boolean;
  onClose: (newConfig: null | BackendConfig) => void;
};

export default function BackendConfigModal(props: ConfigModalProps) {
  /* Dynamically create a form based on the config object */
  const config: BackendConfig = props.config;

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
    reader.onload = (event) => {
      const config = JSON.parse(event.target?.result as string);
      setNewConfig(config);
    };
    reader.readAsText(filePath);
  };

  const formChangeHandler = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const overwrite_config = Object.assign({}, new_config);
    const value = event.target.value;
    // @ts-ignore
    overwrite_config[event.target?.id] = value;
    setNewConfig(overwrite_config);
  };

  const formDropdownHandler = (event: SelectChangeEvent<string>) => {
    const overwrite_config = Object.assign({}, new_config);
    const value = event.target.value as string;
    overwrite_config[event.target.name] = value;
    setNewConfig(overwrite_config);
  };

  const handleListChange = (event: SelectChangeEvent<string[]>) => {
    const selectedNames = event.target.value as string[];

    // Map the selected names back to their full UI config objects
    const selectedConfigs = selectedNames
      .map((name) => props.uiConfigList.find((config) => config.name === name))
      .filter((config): config is UIConfig => config !== undefined)
      .map((config) => ({ id: config.id, name: config.name }));

    setNewConfig({
      ...new_config,
      selectedUiConfigs: selectedConfigs,
    });
  };

  return (
    <div>
      <Dialog
        open={props.open}
        onClose={() => props.onClose(null)}
        PaperProps={{
          style: {
            minHeight: "70%",
            maxHeight: "70%",
          },
        }}
      >
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
          <Stack direction={"row"}>
            <MuiFileInput
              value={filePath}
              onChange={handleChange}
              sx={{ width: "80%", marginRight: "10px" }}
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
          <Typography variant="h6" gutterBottom>
            Experiment Sequence Settings
          </Typography>
          <FormControl fullWidth>
            <InputLabel id="ui-config-select-label">
              Selected UI Configs
            </InputLabel>
            <Select
              labelId="ui-config-select-label"
              label="Selected UI Configs"
              id="ui-config-select"
              multiple
              fullWidth
              margin="dense"
              value={new_config.selectedUiConfigs.map((config) => config.name)}
              onChange={handleListChange}
              input={<OutlinedInput id="select-multiple-chip" label="Chip" />}
              renderValue={(selected) => (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  {selected.map((name) => (
                    <Chip key={name} label={name} />
                  ))}
                </Box>
              )}
            >
              {props.uiConfigList.map((uiConfig) => (
                <MenuItem key={uiConfig.id} value={uiConfig.name}>
                  {uiConfig.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="ui-config-mode-label">UI Config Mode</InputLabel>
            <Select
              labelId="ui-config-mode-label"
              name="uiConfigMode"
              label="UI Config Mode"
              value={new_config.uiConfigMode}
              onChange={formDropdownHandler}
            >
              <MenuItem key="seq_mode_sequential" value="sequential">
                Sequential
              </MenuItem>
              <MenuItem key="seq_mode_alternating" value="alternating">
                Alternating
              </MenuItem>
              <MenuItem key="seq_mode_random" value="random">
                Random
              </MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ marginTop: "1vh" }}>
            <BackendConfigSequenceVisualizer
              uiCOnfigIds={new_config.selectedUiConfigs.map(
                (uiConfig) => uiConfig.name,
              )}
              nrOfBatches={3}
              mode={new_config.uiConfigMode}
            />
          </Box>
          <Typography variant="h6" gutterBottom>
            Additional Settings
          </Typography>
          {Object.keys(new_config).map((key: string, index: number) => {
            if (
              key === "id" ||
              key === "customInput" ||
              key === "uiConfigMode"
            ) {
              return <div key={`empty-${key}`}></div>;
            } else if (
              typeof new_config[key as keyof BackendConfig] === "string"
            ) {
              return (
                <TextField
                  key={key}
                  margin="dense"
                  id={key}
                  label={key}
                  type="text"
                  fullWidth
                  value={new_config[key as keyof BackendConfig]}
                  onChange={formChangeHandler}
                />
              );
            } else if (
              typeof new_config[key as keyof BackendConfig] === "number"
            ) {
              return (
                <TextField
                  key={key}
                  margin="dense"
                  id={key}
                  label={key}
                  type="number"
                  fullWidth
                  value={new_config[key as keyof BackendConfig]}
                  onChange={formChangeHandler}
                />
              );
            } else {
              return <div key={`empty-${key}`}></div>;
            }
          })}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => props.onClose(null)}>Cancel</Button>
          <Button onClick={() => props.onClose(new_config)}>Add Config</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
