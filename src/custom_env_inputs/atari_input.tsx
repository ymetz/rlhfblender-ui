import * as React from 'react';

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';

type AtariInputProps = {
  space: {shape: number[]} & {[key: string]: string};
  action: number;
};

export default function AtariInput(props: AtariInputProps) {
  const [clickedIndex, setClickedIndex] = React.useState<number>(-1);

  if (props.space?.shape?.length === 0) return <></>;

  const num_actions = props.space?.shape[0];

  return (
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
              sx={{backgroundColor: index === clickedIndex ? 'red' : 'blue'}}
              onClick={() => {
                setClickedIndex(index);
              }}
            >
              {props.space['tag_' + index] || action}
            </Button>
          );
        }
      )}
    </Stack>
  );
}
