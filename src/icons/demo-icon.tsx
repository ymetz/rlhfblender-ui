import { useTheme } from "@mui/material/styles";
import IconProps from "./icon-props";

function DemoIcon(props: IconProps) {
  const theme = useTheme();
  // width to height ratio is 22.000587 / 21.411724 = 1.02750189569
  return (
    <svg
      width={`${(props.height || 24) * 1.02750189569}px`}
      height={`${props.height || 24}px`}
      viewBox="0 0 22.000588 21.411724"
      version="1.1"
      id="svg5"
      xmlSpace="preserve"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs id="defs2" />
      <g id="layer1" transform="translate(-127.91947,-103.57906)">
        <ellipse
          fill="none"
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1"
          strokeLinecap="butt"
          strokeLinejoin="round"
          paintOrder="normal"
          cx="145.1937"
          cy="111.57693"
          rx="0.55134046"
          ry="0.52217764"
        />
        <path
          fill="none"
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          paintOrder="normal"
          d="m 140.95338,116.83244 v 2.11667"
        />
        <path
          fill="none"
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="round"
          paintOrder="normal"
          d="m 145.18672,115.24494 v -3.175"
        />
        <rect
          fill={props.color || theme.palette.text.secondary}
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1.43959"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeOpacity="1"
          paintOrder="normal"
          width="6.3500018"
          height="3.8992088"
          x="142.01169"
          y="116.10823"
        />
        <rect
          fill={props.color || theme.palette.text.secondary}
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1.43959"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeOpacity="1"
          paintOrder="normal"
          width="6.3499951"
          height="2.1166692"
          x="142.0117"
          y="122.12411"
          ry="6.0117191e-07"
        />
        <ellipse
          fill="none"
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="0.5"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeOpacity="1"
          paintOrder="normal"
          id="path34502-0-6-4-2-6"
          cx="136.19086"
          cy="105.19078"
          rx="1.0583315"
          ry="1.0583341"
        />
        <ellipse
          fill="none"
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="0.5"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeOpacity="1"
          paintOrder="normal"
          cx="145.71587"
          cy="108.36576"
          rx="1.0583315"
          ry="1.0583341"
        />
        <ellipse
          fill={props.color || theme.palette.text.secondary}
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="0.654459"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeOpacity="1"
          paintOrder="normal"
          cx="131.95752"
          cy="105.29156"
          rx="1.3852729"
          ry="1.3852711"
        />
        <rect
          fill={props.color || theme.palette.text.secondary}
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1.43959"
          strokeLinecap="butt"
          strokeLinejoin="round"
          strokeOpacity="1"
          paintOrder="normal"
          width="3.2265701"
          height="7.7682443"
          x="130.87341"
          y="108.33997"
        />
        <path
          fill="none"
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1.5"
          strokeLinecap="square"
          strokeLinejoin="round"
          strokeDashoffset="0"
          strokeOpacity="1"
          paintOrder="normal"
          d="m 130.89922,116.83244 v 7.40834"
        />
        <path
          fill="none"
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1.5"
          strokeLinecap="square"
          strokeLinejoin="round"
          strokeDashoffset="0"
          strokeOpacity="1"
          paintOrder="normal"
          d="m 134.07422,116.83244 v 7.40834"
        />
        <path
          fill="none"
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDashoffset="0"
          strokeOpacity="1"
          paintOrder="normal"
          d="m 134.07422,108.36578 c 0,0 0.54803,2.92498 2.31192,2.92498 1.76388,-1e-5 2.97975,-1.86665 2.97975,-1.86665"
        />
        <path
          fill="none"
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDashoffset="0"
          strokeOpacity="1"
          paintOrder="normal"
          d="m 130.89922,108.36578 h -1.05833 l -1.05833,6.35"
        />
        <path
          fill="none"
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="1"
          strokeLinecap="round"
          strokeLinejoin="miter"
          strokeDashoffset="0"
          strokeOpacity="1"
          paintOrder="normal"
          d="m 149.42005,116.83244 v 2.11667"
        />
        <path
          fill="none"
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="miter"
          strokeDashoffset="0"
          strokeOpacity="1"
          d="m 137.24922,105.19078 c 0,0 7.40833,0 8.46667,0 l -1e-5,2.11666"
        />
        <path
          fill="none"
          fillOpacity="1"
          stroke={props.color || theme.palette.text.secondary}
          strokeWidth="0.5"
          strokeLinecap="round"
          strokeLinejoin="miter"
          strokeDashoffset="0"
          strokeOpacity="1"
          d="m 139.36589,109.42411 3.17499,-3.175"
        />
      </g>
    </svg>
  );
}

export default DemoIcon;
