import * as React from 'react';

import Button from '@mui/material/Button';

import {styled} from '@mui/material/styles';

import chroma from 'chroma-js';

import {DesignTheme} from '../theme';

const BabyAIInputContainer = styled('div')(({theme}) => ({
  display: 'grid',
  width: '100%',
  height: '100%',
  gridTemplateRows: '1fr 1fr 1fr 1fr 1fr 1fr',
  gridTemplateColumns: '1fr 1fr 1fr',
  gridTemplateAreas: `
        "left forward right"
        "pickup pickup pickup"
        "drop drop drop"
        "toggle toggle toggle"
        "done done done"
        "submit submit submit"
    `,
  gap: theme.spacing(1),
}));

interface StyledBabyAIInputButtonProps {
  theme?: DesignTheme;
  isNextStep?: boolean;
  selected?: boolean;
}

const BabyAIInputButton = styled(Button)<StyledBabyAIInputButtonProps>(
  ({theme, isNextStep, selected}) => ({
    backgroundColor: isNextStep
      ? theme.palette.primary.dark
      : selected
      ? theme.palette.action.hover
      : theme.palette.background.l1,
    border: `1px solid ${theme.palette.divider}`,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: chroma
        .mix(theme.palette.background.l1, theme.palette.primary.main, 0.5)
        .hex(),
    },
    '&:active': {
      backgroundColor: chroma
        .mix(theme.palette.background.l1, theme.palette.primary.main, 0.75)
        .hex(),
    },
  })
);

export default function BabyAIInput(props: any) {
  const [selectedAction, setSelectedAction] = React.useState<number>(-1);
  return (
    <BabyAIInputContainer>
      <BabyAIInputButton
        selected={0 === selectedAction}
        sx={{gridArea: 'left'}}
        onClick={() => {
          setSelectedAction(0);
        }}
      >
        Turn Left
      </BabyAIInputButton>
      <BabyAIInputButton
        selected={2 === selectedAction}
        sx={{gridArea: 'forward'}}
        onClick={() => {
          setSelectedAction(2);
        }}
      >
        Go Forward
      </BabyAIInputButton>
      <BabyAIInputButton
        selected={1 === selectedAction}
        sx={{gridArea: 'right'}}
        onClick={() => {
          setSelectedAction(1);
        }}
      >
        Turn Right
      </BabyAIInputButton>
      <BabyAIInputButton
        selected={3 === selectedAction}
        sx={{gridArea: 'pickup'}}
        onClick={() => {
          setSelectedAction(3);
        }}
      >
        Pickup
      </BabyAIInputButton>
      <BabyAIInputButton
        selected={4 === selectedAction}
        sx={{gridArea: 'drop'}}
        onClick={() => {
          setSelectedAction(4);
        }}
      >
        Drop
      </BabyAIInputButton>
      <BabyAIInputButton
        selected={5 === selectedAction}
        sx={{gridArea: 'toggle'}}
        onClick={() => {
          setSelectedAction(5);
        }}
      >
        Toggle
      </BabyAIInputButton>
      <BabyAIInputButton
        selected={6 === selectedAction}
        sx={{gridArea: 'done'}}
        onClick={() => {
          setSelectedAction(6);
        }}
      >
        Done
      </BabyAIInputButton>
      <BabyAIInputButton
        isNextStep={true}
        sx={{gridArea: 'submit'}}
        onClick={() => {
          props.setFeedback(selectedAction);
        }}
      >
        {props.canNextStep ? 'Next Step' : 'Confirm Action'}
      </BabyAIInputButton>
    </BabyAIInputContainer>
  );
}
