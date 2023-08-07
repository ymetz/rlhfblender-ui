import {Slider} from '@mui/material';
import {styled} from '@mui/material/styles';
import {SyntheticEvent} from 'react';
import Box from '@mui/material/Box';

const HorizontalScrollbarSlider = styled(Slider)(({theme}) => ({
  '& .MuiSlider-rail': {
    color: theme.palette.grey[400],
    height: 30,
  },
  '& .MuiSlider-thumb': {
    width: 100,
    height: 30,
    backgroundColor: '#fff',
    opacity: 0.8,
    border: '1px solid #ccc',
    borderRadius: 4,
    '&:focus, &:hover, &$active': {
      boxShadow: 'inherit',
    },
  },
  '& .MuiSlider-mark': {
    backgroundColor: theme.palette.secondary.light,
    height: 20,
    width: 10,
    zIndex: 9999,
    borderRadius: 4,
    '&.MuiSlider-markActive': {
      opacity: 1,
      backgroundColor: 'currentColor',
    },
  },
}));

const VerticalScrollbarSlider = styled(Slider)(({theme}) => ({
  '& .MuiSlider-rail': {
    color: theme.palette.grey[400],
    height: '100%',
    width: '2vw',
  },
  '& .MuiSlider-thumb': {
    width: '2vw',
    height: 100,
    backgroundColor: '#fff',
    opacity: 0.8,
    border: '1px solid #ccc',
    borderRadius: 4,
    '&:focus, &:hover, &$active': {
      boxShadow: 'inherit',
    },
  },
  '& .MuiSlider-mark': {
    backgroundColor: theme.palette.secondary.light,
    width: 20,
    height: 10,
    zIndex: 9999,
    borderRadius: 4,
    '&.MuiSlider-markActive': {
      opacity: 1,
      backgroundColor: 'currentColor',
    },
  },
}));

interface ScrollbarProps {
  horizontalDrag: boolean;
  episodeCount: number;
  onChange: (e: SyntheticEvent | Event, value: number | number[]) => void;
}

function Scrollbar(props: ScrollbarProps) {
  return props.horizontalDrag ? (
    <HorizontalScrollbarSlider
      track={false}
      aria-label="Scrollbar"
      defaultValue={0}
      max={props.episodeCount}
      min={0}
      step={1}
      marks={Array.from({length: 50}, () =>
        Math.floor(Math.random() * 1000)
      ).map(value => ({value: value}))}
      onChangeCommitted={props.onChange}
    />
  ) : (
    <Box
      id="scrollbar"
      sx={{
        borderSizing: 'border-box',
        p: 1,
      }}
    >
      <VerticalScrollbarSlider
        track={false}
        defaultValue={0}
        max={props.episodeCount}
        min={0}
        step={1}
        orientation="vertical"
        marks={Array.from({length: 50}, () =>
          Math.floor(Math.random() * 1000)
        ).map(value => ({value: value}))}
        onChangeCommitted={props.onChange}
        sx={{
          '& input[type="range"]': {
            WebkitAppearance: 'slider-vertical',
          },
        }}
      />
    </Box>
  );
}

export default Scrollbar;
