import * as React from 'react';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import SendIcon from '@mui/icons-material/Send';
import { GymSpaceInfo } from '../types';

type AtariInputProps = {
  space: GymSpaceInfo;
  setFeedback: (value: number) => void;
  needsSubmit: boolean;
};

export default function AtariInput(props: AtariInputProps) {
  const [selectedAction, setSelectedAction] = React.useState<number>(-1);

  if (props.space?.shape?.length === 0) return <></>;

  const num_actions = props.space?.shape[0];

  return (
    <>
      <Stack
        direction="row"
        spacing={2}
        alignItems="center"
        justifyContent="center"
        sx={{m: 2}}
      >
        {Array.from(Array(num_actions).keys()).map(
          (action: number, index: number) => {
            return (
              <Button
                key={action}
                variant="contained"
                sx={{
                  backgroundColor: index === selectedAction ? 'red' : 'blue',
                }}
                onClick={() => {
                  setSelectedAction(index);
                  !props.needsSubmit && props.setFeedback(index);
                }}
              >
                {props.space.labels[index.toString()] ?? index}
              </Button>
            );
          }
        )}
      </Stack>
      {props.needsSubmit && (
        <Button
          variant="contained"
          endIcon={<SendIcon />}
          onClick={() => {
            props.setFeedback(selectedAction);
          }}
        >
          Next Step
        </Button>
      )}
    </>
  );
}
