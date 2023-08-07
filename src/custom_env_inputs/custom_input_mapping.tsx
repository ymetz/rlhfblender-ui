import * as React from 'react';
import * as customInputs from '.';
import {Feedback} from '../types';

type CustomInputProps = {
  custom_input: string;
  space: object;
  action: number | number[];
  inputProps: object;
  setFeedback: (feedback: Feedback) => void;
};

export function CustomInput(props: CustomInputProps) {
  // Check if the custom input exists
  if (!(props.custom_input in customInputs)) {
    return (
      <div style={{textAlign: 'center'}}>
        <h1>Custom input {props.custom_input} not found</h1>
      </div>
    );
  }

  const CustomInput =
    customInputs[props.custom_input as keyof typeof customInputs];

  return (
    <CustomInput
      {...props.inputProps}
      space={props.space}
      action={props.action}
      setFeedback={props.setFeedback}
    />
  );
}

export function AvailableCustomInputs() {
  return Object.keys(customInputs);
}
