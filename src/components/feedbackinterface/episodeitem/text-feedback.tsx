import React, { useMemo } from "react";
import { Box, TextField, useTheme } from "@mui/material";
import { Feedback, FeedbackType } from "../../../types";
import { EpisodeFromID } from "../../../id";

interface TextFeedbackProps {
  showTextFeedback: boolean;
  scheduleFeedback: (feedback: Feedback) => void;
  episodeId: string;
  sessionId: string;
  hasTextFeedback?: boolean;
  // value: string;
}

function debounce(func: (...args: any[]) => void, wait: number) {
  let timeout: number | undefined;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = window.setTimeout(later, wait);
  };
}

const TextFeedback: React.FC<TextFeedbackProps> = ({
  showTextFeedback,
  scheduleFeedback,
  episodeId,
  sessionId,
  hasTextFeedback,
}) => {
  //const [feedback, setFeedback] = useState('');
  const theme = useTheme();

  const debouncedSubmitFeedback = useMemo(
    () =>
      debounce(
        (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
          const feedback = {
            feedback_type: FeedbackType.Text,
            targets: [
              {
                target_id: episodeId,
                reference: EpisodeFromID(episodeId || ""),
                origin: "offline",
                timestamp: Date.now(),
              },
            ],
            granularity: "episode" as const,
            timestamp: Date.now(),
            session_id: sessionId,
            text_feedback: event.target.value,
          };
          scheduleFeedback(feedback);
        },
        1500,
      ), // 1.5 second delay before adding feedback
    [episodeId, scheduleFeedback, sessionId],
  );
  return (
    <>
      <Box
        component="form"
        sx={{
          display: "flex",
          alignItems: "center",
          borderRadius: "10px",
          backgroundColor: theme.palette.background.l0,
          border: hasTextFeedback
            ? `1px solid ${theme.palette.primary.main}`
            : `1px solid ${theme.palette.divider}`,
          boxShadow: hasTextFeedback
            ? `0px 0px 20px 0px ${theme.palette.primary.main}`
            : "none",
          overflow: "hidden",
          gridArea: "mission",
          margin: "10px",
          width: "auto",
        }}
      >
        <TextField
          onChange={debouncedSubmitFeedback}
          placeholder="Enter your feedback here..."
          multiline
          rows={4}
          fullWidth
          variant="outlined"
        />
      </Box>
    </>
  );
};

const instructionsText = `
1. Be specific and detailed in your observations about the agent's performance.\n
2. Focus on key aspects such as ball control, passing, shooting, defensive positioning, and overall strategy.\n
3. Compare the agent's current performance to previous episodes if possible.\n
4. Provide suggestions for improvement, especially for areas where the agent struggled.\n
5. Describe any unexpected behaviors or decisions made by the agent.\n
6. If possible, prioritize areas that need the most improvement.\n
7. Include timestamps or specific moments in the game when describing notable events.\n
8. Comment on the agent's decision-making, especially under pressure or in critical moments.\n
9. Mention any successful strategies or tactics employed by the agent.\n
10. Provide feedback on the agent's interaction with teammates and response to opponents.\n
\nRemember, your feedback will be used to improve the agent's performance in future games.`;

export { instructionsText };
export default TextFeedback;
