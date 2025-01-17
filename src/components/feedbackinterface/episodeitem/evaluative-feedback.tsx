import React from "react";
import { Box, Slider } from "@mui/material";
import { styled } from "@mui/material/styles";
import chroma from "chroma-js";
import ThumbDown from "@mui/icons-material/ThumbDown";
import ThumbUp from "@mui/icons-material/ThumbUp";
import EvalIcon from "../../../icons/eval-icon";
import { useTheme } from "@mui/material/styles";

interface EvaluativeFeedbackProps {
  value: number;
  onChange: (value: number) => void;
  onCommit: (event: Event | React.SyntheticEvent, value: number) => void;
  hasEvaluativeFeedback: boolean;
  horizontalRanking: boolean;
}

interface EvaluativeContainerProps {
  hasFeedback: boolean;
  horizontalRanking: boolean;
}

const EvaluativeContainer = styled("div")<EvaluativeContainerProps>(
  ({ theme, hasFeedback, horizontalRanking }) => ({
    gridArea: "evaluative",
    display: "grid",
    gridTemplateColumns: "auto auto 1fr auto",
    gridTemplateRows: "1fr",
    borderRadius: "10px",
    boxShadow: hasFeedback
      ? `0px 0px 20px 0px ${theme.palette.primary.main}`
      : "none",
    transition: "box-shadow 0.2s ease-in-out",
    border: hasFeedback
      ? `1px solid ${theme.palette.primary.main}`
      : `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.background.l0,
    margin: "10px",
    alignItems: "center",
    width: horizontalRanking ? "auto" : "50%",
  }),
);

const EvaluativeFeedback: React.FC<EvaluativeFeedbackProps> = ({
  value,
  onChange,
  onCommit,
  hasEvaluativeFeedback,
  horizontalRanking,
}) => {
  const theme = useTheme();

  return (
    <EvaluativeContainer
      hasFeedback={hasEvaluativeFeedback}
      horizontalRanking={horizontalRanking}
    >
      <Box
        sx={{
          m: 1,
          p: 1,
          borderRight: `1px solid ${theme.palette.divider}`,
        }}
      >
        <EvalIcon
          color={
            hasEvaluativeFeedback
              ? theme.palette.primary.main
              : theme.palette.text.secondary
          }
        />
      </Box>
      <ThumbDown
        sx={{
          color: theme.palette.text.secondary,
          m: 1,
          height: "1vw",
          "&:hover": {
            color: theme.palette.primary.main,
          },
        }}
        onClick={() => onChange(Math.max(0, value - 1))}
      />
      <Slider
        step={1}
        min={0}
        max={10}
        value={value}
        valueLabelDisplay="auto"
        marks
        sx={{
          color: chroma
            .mix(
              theme.palette.primary.main,
              theme.palette.text.secondary,
              1.0 - (value + 1) / 10,
            )
            .hex(),
        }}
        onChangeCommitted={onCommit}
      />
      <ThumbUp
        sx={{
          color: theme.palette.primary.main,
          m: 1,
          height: "1vw",
        }}
        onClick={() => onChange(Math.min(10, value + 1))}
      />
    </EvaluativeContainer>
  );
};

export default EvaluativeFeedback;
