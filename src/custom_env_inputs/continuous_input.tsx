import * as React from "react";
import { Box, Button, Slider, Stack, Typography } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import { GymSpaceInfo } from "../types";

type ContinuousActionInputProps = {
  space: GymSpaceInfo;
  setFeedback: (value: number[]) => void;
  needsSubmit: boolean;
};

export default function ContinuousActionInput(
  props: ContinuousActionInputProps,
) {
  const [actionValues, setActionValues] = React.useState<number[]>(
    Array(props.space.shape[0]).fill(0),
  );

  console.log(props.space);

  // Initialize min and max values for each action dimension
  const actionBounds =
    Array.isArray(props.space.low) && Array.isArray(props.space.high)
      ? props.space.low.map((low, index) => ({
          min: low as number,
          max: (props.space.high as number[])[index] as number,
        }))
      : [{ min: props.space.low as number, max: props.space.high as number }];

  const handleChange = (index: number, newValue: number) => {
    const updatedValues = [...actionValues];
    updatedValues[index] = newValue;
    setActionValues(updatedValues);

    // Immediately send feedback if submission isn't required
    if (!props.needsSubmit) {
      props.setFeedback(updatedValues);
    }
  };

  return (
    <Box sx={{ width: "100%", padding: 2 }}>
      <Stack spacing={2}>
        <Typography variant="h6" align="center">
          Continuous Action Input
        </Typography>
        {actionBounds.map((bounds, index) => (
          <Box key={index} sx={{ width: "80%", margin: "0 auto" }}>
            <Typography
              variant="body2"
              align="center"
            >{`Action ${index + 1}`}</Typography>
            <Slider
              value={actionValues[index] as number}
              onChange={(_, newValue) =>
                handleChange(index, newValue as number)
              }
              min={bounds.min}
              max={bounds.max}
              step={(bounds.max - bounds.min) / 100} // Adjust step as needed
              marks={[
                { value: bounds.min, label: (bounds.min as number).toFixed(1) },
                { value: bounds.max, label: (bounds.max as number).toFixed(1) },
              ]}
              valueLabelDisplay="auto"
            />
          </Box>
        ))}
      </Stack>
      {props.needsSubmit && (
        <Button
          variant="contained"
          endIcon={<SendIcon />}
          onClick={() => props.setFeedback(actionValues)}
          sx={{ marginTop: 2 }}
        >
          Submit Actions
        </Button>
      )}
    </Box>
  );
}
