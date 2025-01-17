import React, { useMemo } from "react";
import { useSetupConfigState } from "../../SetupConfigContext";
import Typography from "@mui/material/Typography";

const instructionStrings = {
  rating: "Rate the example via the slider",
  ranking: "Select the best example by clicking on the checkmark",
  correction: "Select a step to correct and double-click on the timeline",
  demonstration: "Click on the demo button to provide a demonstration",
  "feature selection":
    "Click on the feature-selection button to generate an annotation",
  text: "Enter text to provide feedback",
};

const UserInstruction = React.memo(() => {
  const { activeUIConfig } = useSetupConfigState();

  const instructions = useMemo(() => {
    const feedbackTypes = Object.keys(activeUIConfig.feedbackComponents).filter(
      (key) => activeUIConfig.feedbackComponents[key],
    );

    if (feedbackTypes.length === 0) {
      return "No feedback types selected.";
    }

    return feedbackTypes
      .map((type) => {
        const normalizedType = type.replace(/([A-Z])/g, " $1").toLowerCase();
        return instructionStrings[normalizedType];
      })
      .filter(Boolean)
      .join(" • ");
  }, [activeUIConfig.feedbackComponents]);

  return (
    <Typography
      variant="body2"
      sx={{
        color: (theme) => theme.palette.text.secondary,
        fontStyle: "italic",
      }}
    >
      Instructions: {instructions}
    </Typography>
  );
});

UserInstruction.displayName = "UserInstruction";

export default UserInstruction;
