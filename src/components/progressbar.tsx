import {Slider} from '@mui/material';

type ProgressbarProps = {
  maxSteps: number;
  currentStep: number;
};

function Progressbar(props: ProgressbarProps) {
  return (
    <Slider
      aria-label="Progressbar"
      defaultValue={0}
      max={props.maxSteps}
      min={0}
      step={1}
      value={props.currentStep}
      marks={true}
      valueLabelDisplay="auto"
    />
  );
}

export default Progressbar;
