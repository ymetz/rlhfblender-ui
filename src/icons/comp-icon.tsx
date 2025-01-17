import { useTheme } from "@mui/material/styles";
import IconProps from "./icon-props";

function CompIcon(props: IconProps) {
  const theme = useTheme();
  // width to height ratio is 22.666674 / 18.511126 = 1.22448920719
  return (
    <svg
      width="22.666674mm"
      height="18.511126mm"
      viewBox="0 0 22.666673 18.511126"
      version="1.1"
      id="svg5"
      xmlSpace="preserve"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs id="defs2" />
      <g id="layer1" transform="translate(-52.474998,-54.513869)">
        <path
          style={{
            fill: props.color || theme.palette.text.secondary,
            fillOpacity: 1,
            stroke: props.color || theme.palette.text.secondary,
            strokeWidth: 1.5,
            strokeLinejoin: "round",
            strokeDasharray: "none",
            strokeOpacity: 1,
            paintOrder: "normal",
          }}
          id="path19005-2"
          d="m 61.691666,68.042114 a 4.2333336,4.2333331 0 0 1 -2.116667,3.666174 4.2333336,4.2333331 0 0 1 -4.233334,0 4.2333336,4.2333331 0 0 1 -2.116667,-3.666174 h 4.233334 z"
        />
        <path
          style={{
            fill: props.color || theme.palette.text.secondary,
            fillOpacity: 1,
            stroke: props.color || theme.palette.text.secondary,
            strokeWidth: 1.5,
            strokeLinejoin: "round",
            strokeDasharray: "none",
            strokeOpacity: 1,
            paintOrder: "normal",
          }}
          id="path19005-5-9"
          d="m 74.391674,66.98378 a 4.2333336,4.2333331 0 0 1 -2.116667,3.666174 4.2333336,4.2333331 0 0 1 -4.233333,0 4.2333336,4.2333331 0 0 1 -2.116667,-3.666174 h 4.233333 z"
        />
        <path
          style={{
            fill: "none",
            fillOpacity: 1,
            stroke: props.color || theme.palette.text.secondary,
            strokeWidth: 1.5,
            strokeLinecap: "round",
            strokeLinejoin: "round",
            strokeDasharray: "none",
            strokeOpacity: 1,
            paintOrder: "normal",
          }}
          d="m 57.458333,57.458784 12.7,-1.058333"
          id="path19134-1"
        />
        <path
          style={{
            fill: "none",
            fillOpacity: 1,
            stroke: props.color || theme.palette.text.secondary,
            strokeWidth: 0.75,
            strokeLinecap: "butt",
            strokeLinejoin: "bevel",
            strokeDasharray: "none",
            strokeOpacity: 1,
            paintOrder: "normal",
          }}
          d="m 53.224998,68.042115 4.233335,-10.583331 4.233332,10.583331"
          id="path19040-2"
        />
        <path
          style={{
            fill: "none",
            fillOpacity: 1,
            stroke: props.color || theme.palette.text.secondary,
            strokeWidth: 0.75,
            strokeLinecap: "butt",
            strokeLinejoin: "bevel",
            strokeDasharray: "none",
            strokeOpacity: 1,
            paintOrder: "normal",
          }}
          d="m 65.925,66.983784 4.233333,-10.583333 4.233334,10.583333"
          id="path19040-6-7"
        />
        <path
          id="path19069-0"
          style={{
            fill: props.color || theme.palette.text.secondary,
            fillOpacity: 1,
            stroke: props.color || theme.palette.text.secondary,
            strokeWidth: 1.5,
            strokeLinejoin: "round",
            strokeDasharray: "none",
            strokeOpacity: 1,
            paintOrder: "normal",
          }}
          d="m 65.694917,56.525448 a 1.8865787,2.011579 0 0 1 -1.886579,2.011579 1.8865787,2.011579 0 0 1 -1.886579,-2.011579 1.8865787,2.011579 0 0 1 1.886579,-2.011579 1.8865787,2.011579 0 0 1 1.886579,2.011579 z"
        />
      </g>
    </svg>
  );
}

export default CompIcon;
