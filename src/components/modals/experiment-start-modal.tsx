import React, { useState } from "react";
import { useAppState, useAppDispatch } from "../../AppStateContext";
import { useSetupConfigState } from "../../SetupConfigContext";

// MUI Components
import {
  Dialog,
  DialogContent,
  Tabs,
  Tab,
  Card,
  CardContent,
  Typography,
  Button,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  Grid,
  Container,
} from "@mui/material";

// Optional: Import icons if you want to add them to the navigation buttons
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import CheckIcon from "@mui/icons-material/Check";

type ExperimentStartModalProps = {
  onClose: () => void;
};

const ExperimentStartModal = ({ onClose }: ExperimentStartModalProps) => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const setupConfigState = useSetupConfigState();
  const { activeUIConfig } = setupConfigState;
  const [activeTab, setActiveTab] = useState(0);

  const { startModalOpen, startModalContent } = state;

  const handleClose = () => {
    dispatch({ type: "SET_START_MODAL_OPEN", payload: false });
    setActiveTab(0);
    onClose();
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleNext = () => {
    setActiveTab((prev) => Math.min(prev + 1, 2));
  };

  const feedbackTypes = Object.entries(activeUIConfig.feedbackComponents ?? {})
    .filter(([_, v]) => v)
    .map(([key, _]) => ({
      key,
      description: {
        rating:
          "Select a single trajectory from the projection and rate it using the slider (0-10). Videos of the episode will be displayed for review.",
        comparison:
          "Select multiple trajectories to compare them. Choose the best performing episode from the available options.",
        correction:
          "Select a specific state coordinate in the projection and provide textual feedback describing what the agent should do differently in that situation.",
        demonstration:
          "Select a coordinate in the projection to start a live demonstration. Use WebRTC to show the agent how to behave from that state.",
        clusterRating:
          "Select a cluster of states and rate the overall performance of that cluster.",
        }[key],
    }));

  return (
    <Dialog
      open={startModalOpen}
      onClose={handleClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          height: "85vh",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "row",
        },
      }}
    >
      {/* Side Navigation */}
      <Paper
        elevation={0}
        sx={{
          width: 240,
          borderRight: 1,
          borderColor: "divider",
          overflow: "auto",
        }}
      >
        <List>
          {["Introduction", "Feedback Options", "Privacy Policy"].map(
            (text, index) => (
              <ListItem
                button
                key={text}
                selected={activeTab === index}
                onClick={() => setActiveTab(index)}
                sx={{
                  "&.Mui-selected": {
                    backgroundColor: "primary.light",
                    "&:hover": {
                      backgroundColor: "primary.light",
                    },
                  },
                }}
              >
                <ListItemText primary={text} />
              </ListItem>
            ),
          )}
        </List>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3, pt: 2 }}>
          <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
            RLHF-Blender: Instructions
          </Typography>
          <Tabs value={activeTab} onChange={handleTabChange}>
            <Tab label="Introduction" />
            <Tab label="Feedback Options" />
            <Tab label="Privacy Policy" />
          </Tabs>
        </Box>

        <DialogContent sx={{ flex: 1, overflow: "auto" }}>
          {/* Introduction Tab */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Welcome to RLHF-Blender!
              </Typography>
              <Typography paragraph>
                RLHF-Blender is an interactive tool for providing feedback on reinforcement learning agent behavior. 
                The interface consists of two main areas:
              </Typography>
              
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                🗺️ State Sequence Projection (Left Panel)
              </Typography>
              <Typography paragraph>
                The main visualization shows a 2D projection of agent state sequences from multiple episodes. 
                Each trajectory represents an episode, with different colors indicating different episodes or similarity groups.
              </Typography>
              <Box sx={{ backgroundColor: 'rgba(0,0,0,0.05)', p: 2, borderRadius: 1, mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img
                  src="/files/state_sequence_projection.png"
                  alt="State Sequence Projection"
                  style={{ width: "80%", height: "auto", objectFit: "contain" }}
                />
                <Typography variant="body2" color="text.secondary">
                  State sequence projection showing trajectories
                </Typography>
              </Box>
              <Typography paragraph>
                <strong>How to interact:</strong>
              </Typography>
              <Typography component="div" paragraph>
                • <strong>Click Load Data</strong> to load episode trajectories into the projection<br/>
                • <strong>Click on trajectories</strong> to select individual episodes<br/>
                • <strong>Click on coordinates</strong> to select specific states for demonstration<br/>
                • <strong>Use action buttons</strong> (Add ➕, Clear 🗑️, Mark ✏️) to manage selections
              </Typography>

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                📝 Feedback Input (Right Panel)
              </Typography>
              <Typography paragraph>
                Once you select items from the projection, the feedback panel will display options for providing different types of feedback based on your selection.
              </Typography>
              <Box sx={{ backgroundColor: 'rgba(0,0,0,0.05)', p: 2, borderRadius: 1, mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img
                  src="/files/feedback_panel.png"
                  alt="Feedback Panel"
                  style={{ width: "80%", height: "auto", objectFit: "contain" }}
                />
                <Typography variant="body2" color="text.secondary">
                  Feedback panel with one contextual feedback interaction, here a comparison.
                </Typography>
              </Box>

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                🎯 Getting Started
              </Typography>
              <Typography component="div" paragraph>
                1. <strong>Load Data:</strong> Click "Load Data" to populate the projection with episodes<br/>
                2. <strong>Explore:</strong> Click on trajectories or coordinates to select them<br/>
                3. <strong>Provide Feedback:</strong> Use the right panel to rate, compare, or correct selected items<br/>
                4. <strong>Submit:</strong> Your feedback helps improve the AI agent's behavior
              </Typography>

              {startModalContent}
            </Box>
          )}

          {/* Feedback Options Tab */}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Available Feedback Options
              </Typography>
              <Typography paragraph color="text.secondary">
                Based on what you select in the state sequence projection, different feedback options become available. 
                The feedback panel on the right will automatically adapt to show the appropriate interface for your selection.
              </Typography>
              
              <Box sx={{ backgroundColor: 'rgba(0,0,0,0.05)', p: 2, borderRadius: 1, mb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  [Screenshot placeholder: Feedback options panel showing different feedback types]
                </Typography>
              </Box>

              {/* Centered container with reduced width */}
              <Container maxWidth="lg">
                <Grid container spacing={3} justifyContent="center">
                  {feedbackTypes.map(({ key, description }) => (
                    <Grid item xs={12} sm={6} md={3} key={key}>
                      <Card
                        variant="outlined"
                        sx={{
                          height: "100%",
                          transition: "box-shadow 0.3s",
                          "&:hover": {
                            boxShadow: 3,
                          },
                        }}
                      >
                        <CardContent>
                          <Box
                            sx={{
                              aspectRatio: "1",
                              mb: 2,
                              display: "flex",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <img
                              src={`/files/${key}.png`}
                              alt={key}
                              style={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                                objectFit: "contain",
                              }}
                            />
                          </Box>
                          <Typography
                            variant="h6"
                            gutterBottom
                            sx={{ textTransform: "capitalize" }}
                          >
                            {key}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {description}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </Container>
            </Box>
          )}

          {/* Privacy Policy Tab */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Data Protection and Privacy
              </Typography>
              <Typography paragraph color="text.secondary">
                By clicking "Agree and Continue" you agree to participate in
                this study. With your participation in this study, you agree
                that your data will be used for research purposes only. Your
                data will be stored anonymously and will not be passed on to
                third parties. You can withdraw your consent at any time by
                contacting the study supervisor.
              </Typography>
            </Box>
          )}
        </DialogContent>

        {/* Navigation Buttons */}
        <Box
          sx={{
            borderTop: 1,
            borderColor: "divider",
            p: 2,
            display: "flex",
            justifyContent: "flex-end",
            gap: 2,
          }}
        >
          {activeTab !== 2 && (
            <Button
              variant="contained"
              endIcon={<NavigateNextIcon />}
              onClick={handleNext}
            >
              Next
            </Button>
          )}
          {activeTab === 2 && (
            <Button
              variant="contained"
              color="primary"
              endIcon={<CheckIcon />}
              onClick={handleClose}
            >
              Agree and Continue
            </Button>
          )}
        </Box>
      </Box>
    </Dialog>
  );
};

export default ExperimentStartModal;
