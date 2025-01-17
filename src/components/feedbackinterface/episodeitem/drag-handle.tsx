import React from "react";
import { DragIndicator } from "@mui/icons-material";
import { useTheme } from "@mui/material/styles";
import { styled } from "@mui/system";

interface DragHandleProps {
  horizontalRanking: boolean;
  numItemsInColumn?: number;
}

const DragHandleContainer = styled("div")({
  gridArea: "drag",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  cursor: "grab",
});

const DragHandle: React.FC<
  DragHandleProps & React.HTMLAttributes<HTMLDivElement>
> = ({ horizontalRanking, numItemsInColumn = 1, ...dragHandleProps }) => {
  const theme = useTheme();

  return (
    <DragHandleContainer {...dragHandleProps}>
      <DragIndicator
        sx={{
          transform: horizontalRanking ? "rotate(90deg)" : "none",
          m: 1,
          color: theme.palette.text.secondary,
        }}
      />
    </DragHandleContainer>
  );
};

export default DragHandle;
