import * as React from 'react';
import * as spaces from '.';

type SpaceProps = {
  space: {label: string};
  spaceProps: object;
};

const SpaceMapping = {
  Discrete: spaces.Categorical,
  //"Box": spaces.Box,
  //"MultiDiscrete": spaces.MultiDiscrete,
  //"MultiBinary": spaces.MultiBinary,
  //"Tuple": spaces.Tuple,
  //"Dict": spaces.Dict,
};

export default function Space(props: SpaceProps) {
  // Check if label exists in space
  if (!('label' in props.space)) {
    return <></>;
  }
  const label = props.space?.label.split('(')[0] || 'Discrete';

  // Check if the custom input exists
  if (!(label in SpaceMapping)) {
    return (
      <div>
        <h1>Action Space {label} not found</h1>
      </div>
    );
  }

  const ConfiguredSpace = SpaceMapping[label as keyof typeof SpaceMapping];

  return <ConfiguredSpace {...props.spaceProps} />;
}

export function AvailableSpaces() {
  return Object.keys(spaces);
}
