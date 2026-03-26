import React, { useState } from "react";
import { useAppState, useAppDispatch } from "../../AppStateContext";
import { useOptionalActiveLearningDispatch } from "../../ActiveLearningContext";
import PracticeDemoPanel from "../practice/PracticeDemoPanel";

// MUI Components
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Dialog,
  DialogContent,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/GridLegacy";

// Icons
import CheckIcon from "@mui/icons-material/Check";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import PrivacyTipOutlinedIcon from "@mui/icons-material/PrivacyTipOutlined";

type ExperimentStartModalProps = {
  onClose: () => void;
};

const FEEDBACK_TYPE_DESCRIPTIONS = {
  rating:
    "Select a single trajectory from the projection and rate it using the slider (0-10). Videos of the episode will be displayed for review.",
  comparison:
    "Select multiple trajectories to compare them by activating the multi-selection mode. Choose the best performing episode from the available options.",
  demonstration:
    "Select an empty coordinate in the projection to start a demonstration for an unknown state. Demonstrate behavior via keyboard controls.",
  correction:
    "Select a single state to correct from this position.",
  clusterRating:
    "Select a cluster of states and rate the overall performance of that cluster.",
} as const;

const ALL_FEEDBACK_TYPES: Array<{
  key: keyof typeof FEEDBACK_TYPE_DESCRIPTIONS;
  label: string;
}> = [
  { key: "rating", label: "Rating" },
  { key: "comparison", label: "Comparison" },
  { key: "demonstration", label: "Demonstrations" },
  { key: "correction", label: "Correction" },
  { key: "clusterRating", label: "ClusterRatings" },
];

const ExperimentStartModal = ({ onClose }: ExperimentStartModalProps) => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const activeLearningDispatch = useOptionalActiveLearningDispatch();
  const [activeTab, setActiveTab] = useState(0);
  const [ssvSlide, setSsvSlide] = useState(0);

  const { startModalOpen, startModalContent } = state;

  const handleClose = () => {
    if (activeLearningDispatch) {
      activeLearningDispatch({ type: 'REMOVE_USER_GENERATED_TRAJECTORIES_BY_SOURCE', payload: 'practice' });
    }
    dispatch({ type: "SET_START_MODAL_OPEN", payload: false });
    setActiveTab(0);
    onClose();
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const navigationItems = [
    "Introduction",
    "User Interface",
    "Feedback Options",
    "Privacy Policy",
    "Your Task",
    "Practice Controls",
  ];

  const handleNext = () => {
    setActiveTab((prev) => Math.min(prev + 1, navigationItems.length - 1));
  };

  const feedbackTypes = ALL_FEEDBACK_TYPES.map(({ key, label }) => ({
    key,
    label,
    description: FEEDBACK_TYPE_DESCRIPTIONS[key],
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
          {navigationItems.map((text, index) => (
            <ListItemButton
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
            </ListItemButton>
          ))}
        </List>
      </Paper>

      {/* Main Content */}
      <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3, pt: 2 }}>
          <Typography variant="h5" component="h2" sx={{ mb: 2 }}>
            Study Instructions
          </Typography>
          <Tabs value={activeTab} onChange={handleTabChange}>
            {navigationItems.map((label) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>
        </Box>

        <DialogContent sx={{ flex: 1, overflow: "auto" }}>
          {/* Introduction Tab */}
          {activeTab === 0 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                🎯 Getting Started: Please read the following instructions carefully.
              </Typography>
              <Typography paragraph>
                This interactive tool allows users to provide feedback for reinforcement learning agent behavior.
                The following instructions will give you a high-level overview of the study's goal and precedure.
              </Typography>

              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                🧩 Basics of RLHF
              </Typography>
              <Typography paragraph>
                Your task will be to provide feedback to help the agent learn the desired behavior. Let's start by giving a very brief overview of the underlying concept of Reinforcement Learning from Human Feedback (RLHF).
              </Typography>

                <Box sx={{ p: 2, borderRadius: 1, mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img
                  src="/files/RLHF_Summary.png"
                  alt="RLHF Summary"
                  style={{ width: "100%", height: "auto", objectFit: "contain" }}
                />
                <Typography variant="body2" color="text.secondary">
                  As the human annotator, you observe the agent's behavior and provide feedback. This feedback is used to train a reward model, which in turn guides the agent's learning process. The updated agent
                  is then recorded and provided back to you in an iterative training process.
                </Typography>
              </Box>

              {startModalContent}
            </Box>
          )}

          {/* User Interface Introduction*/}
          {activeTab === 1 && (
            <Box>
              <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                🗺️ State Sequence Projection (Left Panel)
              </Typography>
              <Typography paragraph>
                The main visualization shows a 2D projection of agent state sequences from multiple episodes. 
                Each trajectory represents an episode, with different colors indicating different episodes or similarity groups.
              </Typography>
              {/* SSV Carousel */}
              <Box
                sx={{
                  backgroundColor: 'rgba(0,0,0,0.05)',
                  p: 2,
                  borderRadius: 1,
                  mb: 2,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <Box sx={{ width: '100%', maxWidth: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={["/files/SSV_Explanation_1.png", "/files/SSV_Explanation_2.png", "/files/SSV_Explanation_3.png", "/files/SSV_Explanation_4.png", "/files/SSV_Explanation_5.png", "/files/SSV_Explanation_6.png"][ssvSlide]}
                    alt={`SSV Explanation ${ssvSlide + 1}`}
                    style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
                  />
                </Box>
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary" align="center">
                    {
                      [
                        '1. The State Sequence View can be used to navigate through recorded behavior of the robot. The 2D coordinates correspond to positions of the robot arm. We use a dimensionality reduction technqiue (PCA) to generate 2D coordinates from mutli-dimensional inputs.',
                        '2. You can dynamically select and view episodes, either by clicking on a line or selecting an episode from the episode list.',
                        '3. The view has a consistent color scale, encoding both the predicted reward of the underlying reward modeland uncertainty.',
                        '4. You select single states wthin a sequence, and also use the time-line to switch between states.',
                        '5. By clicking on the dashed outlines, you can select an entire cluster of states.',
                        '6. Depending on your selection, different feedback options will be available in the feedback panel on the right.',
                      ][ssvSlide]
                    }
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 1, width: '100%' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setSsvSlide((prev) => (prev + 5) % 6)}
                  >
                    Prev
                  </Button>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {[0,1,2,3,4,5].map((i) => (
                      <Box
                        key={i}
                        onClick={() => setSsvSlide(i)}
                        sx={{
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          cursor: 'pointer',
                          backgroundColor: i === ssvSlide ? 'primary.main' : 'grey.400',
                        }}
                      />
                    ))}
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => setSsvSlide((prev) => (prev + 1) % 6)}
                  >
                    Next
                  </Button>
                </Box>
              </Box>
            </Box>
          )}          

          {/* Feedback Options Tab */}
          {activeTab === 2 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Available Feedback Options
              </Typography>
              <Typography paragraph color="text.secondary">
                Based on what you select in the state sequence projection, different feedback options become available. 
                The feedback panel on the right will automatically adapt to show the appropriate interface for your selection.
              </Typography>

              {/* Centered container with reduced width */}
              <Container maxWidth="lg">
                <Grid container spacing={3} justifyContent="center">
                  {feedbackTypes.map(({ key, label, description }) => (
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
                            sx={{ textTransform: "none" }}
                          >
                            {label}
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
          {activeTab === 3 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 3, mt: 3 }}>
              <Typography variant="h6">
                Data Protection and Privacy
              </Typography>
              <Typography color="text.secondary">
                By clicking "Agree and Continue" you consent to participate in this research study. Your inputs are
                stored without personal identifiers and never shared outside the study team. You may withdraw at any
                point by notifying the study supervisor.
              </Typography>

              <Paper variant="outlined" sx={{ p: 2, backgroundColor: (theme) => theme.palette.action.hover }}>
                <Typography variant="subtitle1" gutterBottom>
                  What we collect to run the study
                </Typography>
                <List dense disablePadding>
                  <ListItem disableGutters sx={{ alignItems: "flex-start" }}>
                    <ListItemIcon sx={{ minWidth: 32, pt: 0.5 }}>
                      <PrivacyTipOutlinedIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Screen recordings of the interface during your session"
                      secondary="Used to review participant interactions and troubleshoot potential issues."
                    />
                  </ListItem>
                  <ListItem disableGutters sx={{ alignItems: "flex-start" }}>
                    <ListItemIcon sx={{ minWidth: 32, pt: 0.5 }}>
                      <PrivacyTipOutlinedIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Feedback inputs and interaction events"
                      secondary="Ratings, selections, and timeline interactions captured to evaluate feedback quality."
                    />
                  </ListItem>
                  <ListItem disableGutters sx={{ alignItems: "flex-start" }}>
                    <ListItemIcon sx={{ minWidth: 32, pt: 0.5 }}>
                      <PrivacyTipOutlinedIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="System logs and timestamps"
                      secondary="Technical diagnostics (e.g., latency, errors) recorded to keep the system stable."
                    />
                  </ListItem>
                  <ListItem disableGutters sx={{ alignItems: "flex-start" }}>
                    <ListItemIcon sx={{ minWidth: 32, pt: 0.5 }}>
                      <PrivacyTipOutlinedIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText
                      primary="Session audio when explicit consent is given"
                      secondary="Think-aloud protocols are only recorded in moderated sessions—not in browser-only studies."
                    />
                  </ListItem>
                </List>
              </Paper>

              <Alert severity="info" variant="outlined">
                We erase raw recordings on request and publish only aggregated, anonymized results. Contact the study
                supervisor if you need clarification or data deletion after participation.
              </Alert>
            </Box>
          )}

          {/* Your Task Tab */}
          {activeTab === 4 && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Your Task
              </Typography>
              <Typography paragraph>
                Your task is to teach the robot the correct behavior using the feedback tools presented in this interface. Provide feedback to guide learning so the agent improves over time.
              </Typography>
              <Typography paragraph>
                The specific goal is to sweep the wooden square into the goal area, which is marked by a blue circle.
              </Typography>
              <Box sx={{ backgroundColor: 'rgba(0,0,0,0.05)', p: 2, borderRadius: 1, mb: 2, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <video controls style={{ width: '100%', maxWidth: 600 }}>
                <source src="/files/goal_video.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                <Typography variant="body2" color="text.secondary">
                  Demonstration of the desired outcome: sweeping the wooden square into the blue goal area.
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                You are free to choose whatever feedback you think. is most helpful to teach the desired behavior and is most time-efficient for you.
              </Typography>
            </Box>
          )}

          {/* Practice Controls Tab */}
          {activeTab === navigationItems.length - 1 && (
            <PracticeDemoPanel />
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
          {activeTab !== navigationItems.length - 1 && (
            <Button
              variant="contained"
              endIcon={<NavigateNextIcon />}
              onClick={handleNext}
            >
              Next
            </Button>
          )}
          {activeTab === navigationItems.length - 1 && (
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
