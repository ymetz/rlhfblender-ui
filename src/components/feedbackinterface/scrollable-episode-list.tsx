import Scrollbar from "./scrollbar";
import SmallEpisodeItem from "./episodeitem/small-episode-item";
import Box from "@mui/material/Box";
import { Episode } from "../../types";
import { IDfromEpisode } from "../../id";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
import React from "react";

interface AlternativeScrollableEpisodeListProps {
  episodeIDs: Episode[];
  rankeableEpisodeIDs: string[];
}

const ScrollableEpisodeList: React.FC<
  AlternativeScrollableEpisodeListProps
> = ({ episodeIDs, rankeableEpisodeIDs }) => {
  let draggableIndex = 0;
  const { setNodeRef } = useDroppable({
    id: "scrollable-episode-list",
    disabled: true,
  });
  const itemIds = episodeIDs.map((episodeID) => {
    const id = IDfromEpisode(episodeID);
    return rankeableEpisodeIDs.includes(id) ? `${id}_duplicate` : id;
  });
  return (
    <SortableContext
      items={itemIds}
      strategy={horizontalListSortingStrategy}
    >
      <Box id="scrollable-episode-list" ref={setNodeRef}>
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
    </SortableContext>
  );
};

export default ScrollableEpisodeList;
