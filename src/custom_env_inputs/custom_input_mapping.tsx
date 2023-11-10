import * as React from 'react';
import * as customInputs from '.';

type CustomInputProps = {
  custom_input: string;
  space: any;
  action?: any;
  needSubmit: boolean;
  canNextStep: boolean;
  inputProps: any;
  setFeedback: (feedback: any) => void;
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
      setFeedback={props.setFeedback}
      needsSubmit={props.needSubmit}
      canNextStep={props.canNextStep}
    />
  );
}

export function AvailableCustomInputs() {
  return Object.keys(customInputs);
}
