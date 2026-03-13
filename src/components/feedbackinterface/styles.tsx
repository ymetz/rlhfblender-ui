import { styled } from "@mui/system";
import { StyledDroppableColumnContainerProps } from "./types";

function generateTemplateColumns(props: StyledDroppableColumnContainerProps) {
  let templateString = "";
  if (props.horizontalRanking) {
    for (let i = 0; i < props.columnOrder.length; i++) {
      if (props.ranks[props.columnOrder[i]].episodeItemIDs.length > 0) {
        templateString += "minmax(360px, 520px) ";
      } else {
        templateString += "56px ";
      }
    }
  } else {
    templateString = "1fr";
  }
  return templateString;
}

function generateTemplateRows(props: StyledDroppableColumnContainerProps) {
  let templateString = "";
  if (props.horizontalRanking) {
    templateString = "1fr";
  } else {
    for (let i = 0; i < props.columnOrder.length; i++) {
      if (props.ranks[props.columnOrder[i]].episodeItemIDs.length > 0) {
        templateString += "1fr ";
      } else {
        templateString += "auto ";
      }
    }
  }
  return templateString;
}

export const DroppableColumnContainer = styled(
  "div",
)<StyledDroppableColumnContainerProps>`
  display: grid;
  flex: 1;
  grid-template-columns: ${(props) => generateTemplateColumns(props)};
  grid-template-rows: ${(props) => generateTemplateRows(props)};
  gap: 10px;
  justify-content: center;
  align-content: start;
  width: 100%;
  padding: 10px 12px 14px;
  box-sizing: border-box;
  overflow: auto;
`;
