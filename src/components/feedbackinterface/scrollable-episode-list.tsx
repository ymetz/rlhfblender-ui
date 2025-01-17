import Scrollbar from "./scrollbar";
import SmallEpisodeItem from "./episodeitem/small-episode-item";
import Box from "@mui/material/Box";
import { Episode } from "../../types";
import { IDfromEpisode } from "../../id";
import { Droppable } from "react-beautiful-dnd";
import React from "react";

interface AlternativeScrollableEpisodeListProps {
  episodeIDs: Episode[];
  rankeableEpisodeIDs: string[];
}

const ScrollableEpisodeList: React.FC<
  AlternativeScrollableEpisodeListProps
> = ({ episodeIDs, rankeableEpisodeIDs }) => {
  let draggableIndex = 0;
  return (
    <Droppable
      droppableId={"scrollable-episode-list"}
      direction="horizontal"
      isDropDisabled={true}
    >
      {(provided) => (
        <Box
          id="scrollable-episode-list"
          ref={provided.innerRef}
          {...provided.droppableProps}
        >
          <Scrollbar>
            {episodeIDs.map((episodeID, index) => (
              <SmallEpisodeItem
                key={index}
                isRankeable={rankeableEpisodeIDs.includes(
                  IDfromEpisode(episodeID),
                )}
                episodeID={episodeID}
                draggableIndex={draggableIndex++}
              />
            ))}
          </Scrollbar>
        </Box>
      )}
    </Droppable>
  );
};

export default ScrollableEpisodeList;
