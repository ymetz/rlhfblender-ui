import AlternativeScrollbar from "./alt-scrollbar";
import SmallEpisodeItem from "./feedbackinterface/episodeitem/small-episode-item";
import Box from "@mui/material/Box";
import { Episode } from "../types";
import { IDfromEpisode } from "../id";
<<<<<<< HEAD
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable";
=======
import { Droppable } from '@hello-pangea/dnd';
>>>>>>> origin/vis-short-projections
import React from "react";

interface AlternativeScrollableEpisodeListProps {
  episodeIDs: Episode[];
  rankeableEpisodeIDs: string[];
  getThumbnail: (episodeID: string) => Promise<string | undefined>;
}

const AlternativeScrollableEpisodeList: React.FC<
  AlternativeScrollableEpisodeListProps
> = ({ episodeIDs, rankeableEpisodeIDs, getThumbnail }) => {
  // Colors only used for debugging
  const colors = [
    "#fbf8cc",
    "#fde4cf",
    "#ffcfd2",
    "#f1c0e8",
    "#cfbaf0",
    "#a3c4f3",
    "#90dbf4",
    "#8eecf5",
    "#98f5e1",
    "#b9fbc0",
  ];
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
        <AlternativeScrollbar>
          {episodeIDs.map((episodeID, index) => (
            <SmallEpisodeItem
              key={index}
              color={colors[index % colors.length]}
              isRankeable={rankeableEpisodeIDs.includes(
                IDfromEpisode(episodeID),
              )}
              episodeID={episodeID}
              draggableIndex={draggableIndex++}
              getThumbnail={getThumbnail}
            />
          ))}
        </AlternativeScrollbar>
      </Box>
    </SortableContext>
  );
};

export default AlternativeScrollableEpisodeList;
