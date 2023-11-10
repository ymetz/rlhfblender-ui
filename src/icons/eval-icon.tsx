import {useTheme} from '@mui/material/styles';
import IconProps from './icon-props';

function EvalIcon(props: IconProps) {
  const theme = useTheme();
  // width to height ratio is 22.666668 / 23.19562 = 0.97719604
  return (
    <svg
      width={`${(props.height || 24) * 0.97719604}px`}
      height={`${props.height || 24}px`}
      version="1.1"
      id="svg5"
      xmlSpace="preserve"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs id="defs2" />
      <g id="layer1" transform="translate(-26.766666,-51.637604)">
        <path
          fill={props.color || theme.palette.text.secondary}
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1.5"
          strokeLinejoin="round"
          paintOrder="normal"
          d="m 27.516666,64.029165 v -7.408333 l 4.233333,-4.233334 v 1.058333 l -1.058333,3.175001 h 6.35 v 2.116666 L 34.925,64.029165 Z"
        />
        <path
          fill={props.color || theme.palette.text.secondary}
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeOpacity="1"
          paintOrder="normal"
          d="m 48.683332,62.441664 v 7.408333 l -4.233333,4.233334 v -1.058333 l 1.058332,-3.175001 h -6.35 v -2.116666 l 2.116666,-5.291667 z"
        />
      </g>
    </svg>
  );
}

export default EvalIcon;
