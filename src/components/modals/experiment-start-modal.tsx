import React, { useState } from "react";
import {
  Box,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import CheckIcon from "@mui/icons-material/Check";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";

import { useOptionalActiveLearningDispatch } from "../../ActiveLearningContext";
import { useAppDispatch, useAppState } from "../../AppStateContext";
import PracticeDemoPanel from "../practice/PracticeDemoPanel";

type ExperimentStartModalProps = {
  onClose: () => void;
};

const NAVIGATION_ITEMS = ["Introduction", "Your Task", "Practice Controls"];

const ExperimentStartModal = ({ onClose }: ExperimentStartModalProps) => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const activeLearningDispatch = useOptionalActiveLearningDispatch();
  const [activeTab, setActiveTab] = useState(0);

  const handleClose = () => {
    if (activeLearningDispatch) {
      activeLearningDispatch({
        type: "REMOVE_USER_GENERATED_TRAJECTORIES_BY_SOURCE",
        payload: "practice",
      });
    }
    dispatch({ type: "SET_START_MODAL_OPEN", payload: false });
    setActiveTab(0);
    onClose();
  };

  if (!state.startModalOpen) {
    return null;
  }

  return (
    <Box
      component="main"
      aria-label="Study instructions"
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
        bgcolor: "background.default",
        p: { xs: 1, md: 1.5 },
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          width: "100%",
          height: "100%",
          minHeight: 0,
          mx: "auto",
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: { xs: "none", md: "block" },
            width: 180,
            flexShrink: 0,
            borderRight: 1,
            borderColor: "divider",
            overflow: "auto",
          }}
        >
          <List
            sx={{
              display: { xs: "flex", md: "block" },
              p: 1,
            }}
          >
            {NAVIGATION_ITEMS.map((text, index) => (
              <ListItemButton
                key={text}
                selected={activeTab === index}
                onClick={() => setActiveTab(index)}
                sx={{
                  borderRadius: 1,
                  py: 0.75,
                  "&.Mui-selected": {
                    backgroundColor: "primary.light",
                    "&:hover": { backgroundColor: "primary.light" },
                  },
                }}
              >
                <ListItemText primary={text} />
              </ListItemButton>
            ))}
          </List>
        </Box>

        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Box
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              px: { xs: 1.5, md: 2 },
              py: { xs: 0.5, md: 1 },
            }}
          >
            <Typography variant="h6" component="h2">
              Study Instructions
            </Typography>
            <Tabs
              value={activeTab}
              onChange={(_, newValue: number) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                display: { xs: "flex", md: "none" },
                minHeight: 36,
                mt: 0.25,
                "& .MuiTab-root": {
                  minHeight: 36,
                  py: 0.5,
                  px: 1.25,
                  fontSize: "0.75rem",
                },
              }}
            >
              {NAVIGATION_ITEMS.map((label) => (
                <Tab key={label} label={label} />
              ))}
            </Tabs>
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              px: { xs: 1.5, md: 2 },
              py: 1.5,
            }}
          >
            {activeTab === 0 && (
              <Box
                sx={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "0.8fr 1.4fr" },
                  gap: { xs: 1.5, lg: 2 },
                  alignItems: "start",
                }}
              >
                <Box
                  sx={{
                    minWidth: 0,
                  }}
                >
                  <Typography variant="h6" gutterBottom>
                    Getting started
                  </Typography>
                  <Typography variant="body2" paragraph>
                    In this study, you will provide feedback on the behavior of
                    a reinforcement-learning agent. Your feedback will help
                    teach the agent which behavior is useful for completing its
                    task.
                  </Typography>

                  <Typography variant="h6" gutterBottom sx={{ mt: 1.5 }}>
                    The basic RLHF loop
                  </Typography>
                  <Typography variant="body2">
                    You observe recorded agent behavior and provide human
                    feedback. A reward model learns from that feedback and
                    guides later agent training. You will see updated behavior
                    over the course of the study.
                  </Typography>
                </Box>

                <Box
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    bgcolor: "action.hover",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.75,
                  }}
                >
                  <Box
                    component="img"
                    src="/files/RLHF_Summary.png"
                    alt="Diagram of the reinforcement learning from human feedback loop"
                    sx={{
                      width: "100%",
                      maxHeight: 330,
                      objectFit: "contain",
                    }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    You are the human annotator in this loop. The exact feedback
                    controls will be introduced at the start of each phase.
                  </Typography>
                </Box>

                {state.startModalContent && (
                  <Box sx={{ gridColumn: { lg: "1 / -1" } }}>
                    {state.startModalContent}
                  </Box>
                )}
              </Box>
            )}

            {activeTab === 1 && (
              <Box
                sx={{
                  width: "100%",
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "0.8fr 1.4fr" },
                  gap: { xs: 1.5, lg: 2 },
                  alignItems: "start",
                }}
              >
                <Box
                  sx={{ minWidth: 0 }}
                >
                  <Typography variant="h6" gutterBottom>
                    Your task
                  </Typography>
                  <Typography variant="body2" paragraph>
                    Teach the robot the desired behavior using the feedback
                    tools presented during each phase. Focus on whether the
                    behavior helps complete the goal, rather than how polished
                    the movement looks.
                  </Typography>
                  <Typography variant="body2" paragraph>
                    The goal is to sweep the wooden square into the target area,
                    marked by a blue circle.
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Each phase will explain which feedback is available and how
                    to use that phase&apos;s interface before the task begins.
                  </Typography>
                </Box>
                <Box
                  sx={{
                    bgcolor: "action.hover",
                    p: 1.25,
                    borderRadius: 2,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 0.75,
                  }}
                >
                  <Box
                    component="video"
                    controls
                    sx={{
                      width: "100%",
                      maxHeight: 330,
                      borderRadius: 1,
                    }}
                  >
                    <source src="/files/goal_video.mp4" type="video/mp4" />
                    Your browser does not support the video tag.
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Desired outcome: sweep the wooden square into the blue
                    target area.
                  </Typography>
                </Box>
              </Box>
            )}

            {activeTab === NAVIGATION_ITEMS.length - 1 && <PracticeDemoPanel />}
          </Box>

          <Box
            sx={{
              borderTop: 1,
              borderColor: "divider",
              px: 1.5,
              py: 1,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            {activeTab < NAVIGATION_ITEMS.length - 1 ? (
              <Button
                variant="contained"
                endIcon={<NavigateNextIcon />}
                onClick={() => setActiveTab((previous) => previous + 1)}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                endIcon={<CheckIcon />}
                onClick={handleClose}
              >
                Continue to phase instructions
              </Button>
            )}
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};

export default ExperimentStartModal;
