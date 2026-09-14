import React, { useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

export type StudySurveyKind = "demographics" | "phase" | "overall";

export type StudySurveyResponses = {
  age?: number;
  gender?: string;
  visualImpairments?: string;
  reinforcementLearningExperience?: number;
  visualizationExperience?: number;
  interfaceEase?: number;
  feedbackImpact?: number;
  feedbackFrustration?: number;
  favoritePhase?: string;
  mostImpactfulPhase?: string;
  mostTransparentPhase?: string;
  visualInteractiveDeployment?: string;
  additionalComments?: string;
};

type StudyPhaseSurveyScreenProps = {
  surveyKind: StudySurveyKind;
  phaseLabel?: string;
  phaseIndex?: number;
  totalPhases?: number;
  phaseOptions?: string[];
  loading?: boolean;
  errorMessage?: string | null;
  onSubmit: (responses: StudySurveyResponses) => void;
};

type LikertQuestionProps = {
  label: string;
  value: number | null;
  lowLabel: string;
  highLabel: string;
  error?: boolean;
  onChange: (value: number) => void;
};

const LikertQuestion: React.FC<LikertQuestionProps> = ({
  label,
  value,
  lowLabel,
  highLabel,
  error = false,
  onChange,
}) => (
  <FormControl required error={error} fullWidth>
    <FormLabel
      sx={{ color: "text.primary", fontWeight: 600, fontSize: "0.875rem" }}
    >
      {label}
    </FormLabel>
    <Box
      sx={{
        mt: 0.5,
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "105px 1fr 105px" },
        alignItems: "center",
        gap: 0.5,
      }}
    >
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ textAlign: { sm: "right" } }}
      >
        {lowLabel}
      </Typography>
      <RadioGroup
        row
        value={value === null ? "" : String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        sx={{ justifyContent: "space-evenly", flexWrap: "nowrap" }}
      >
        {[1, 2, 3, 4, 5].map((option) => (
          <FormControlLabel
            key={option}
            value={String(option)}
            control={<Radio size="small" sx={{ p: 0.5 }} />}
            label={String(option)}
            labelPlacement="bottom"
            slotProps={{ typography: { variant: "caption" } }}
            sx={{ m: 0 }}
          />
        ))}
      </RadioGroup>
      <Typography variant="caption" color="text.secondary">
        {highLabel}
      </Typography>
    </Box>
    {error && (
      <Typography variant="caption" color="error" sx={{ mt: 0.25 }}>
        Please select a response.
      </Typography>
    )}
  </FormControl>
);

const StudyPhaseSurveyScreen: React.FC<StudyPhaseSurveyScreenProps> = ({
  surveyKind,
  phaseLabel = "this phase",
  phaseIndex = 1,
  totalPhases = 1,
  phaseOptions = [],
  loading = false,
  errorMessage = null,
  onSubmit,
}) => {
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [visualImpairments, setVisualImpairments] = useState("");
  const [rlExperience, setRlExperience] = useState<number | null>(null);
  const [visualizationExperience, setVisualizationExperience] = useState<
    number | null
  >(null);
  const [interfaceEase, setInterfaceEase] = useState<number | null>(null);
  const [feedbackImpact, setFeedbackImpact] = useState<number | null>(null);
  const [feedbackFrustration, setFeedbackFrustration] = useState<number | null>(
    null,
  );
  const [favoritePhase, setFavoritePhase] = useState("");
  const [mostImpactfulPhase, setMostImpactfulPhase] = useState("");
  const [mostTransparentPhase, setMostTransparentPhase] = useState("");
  const [visualInteractiveDeployment, setVisualInteractiveDeployment] =
    useState("");
  const [additionalComments, setAdditionalComments] = useState("");
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);

  const parsedAge = Number(age);
  const formValid =
    surveyKind === "demographics"
      ? Number.isInteger(parsedAge) &&
        parsedAge >= 18 &&
        parsedAge <= 100 &&
        Boolean(gender) &&
        Boolean(visualImpairments.trim()) &&
        rlExperience !== null &&
        visualizationExperience !== null
      : surveyKind === "phase"
        ? interfaceEase !== null &&
          feedbackImpact !== null &&
          feedbackFrustration !== null
        : Boolean(favoritePhase) &&
          Boolean(mostImpactfulPhase) &&
          Boolean(mostTransparentPhase);

  const header =
    surveyKind === "demographics"
      ? {
          eyebrow: "Before you begin",
          title: "About you",
          description:
            "Complete these questions once before starting the first phase. Your responses are saved with your anonymous study session.",
        }
      : surveyKind === "overall"
        ? {
            eyebrow: "Final questionnaire",
            title: "Compare the phases",
            description:
              "Reflect on the three feedback approaches before completing the study.",
          }
        : {
            eyebrow: `Phase ${phaseIndex} of ${totalPhases} · Exit survey`,
            title: `Tell us about ${phaseLabel}`,
            description:
              "Complete this short questionnaire before continuing to the next part of the study.",
          };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setAttemptedSubmit(true);
    if (!formValid || loading) {
      return;
    }

    if (surveyKind === "demographics") {
      onSubmit({
        age: parsedAge,
        gender,
        visualImpairments: visualImpairments.trim(),
        reinforcementLearningExperience: rlExperience ?? undefined,
        visualizationExperience: visualizationExperience ?? undefined,
      });
      return;
    }

    if (surveyKind === "overall") {
      onSubmit({
        favoritePhase,
        mostImpactfulPhase,
        mostTransparentPhase,
        visualInteractiveDeployment:
          visualInteractiveDeployment.trim() || undefined,
        additionalComments: additionalComments.trim() || undefined,
      });
      return;
    }

    onSubmit({
      interfaceEase: interfaceEase ?? undefined,
      feedbackImpact: feedbackImpact ?? undefined,
      feedbackFrustration: feedbackFrustration ?? undefined,
    });
  };

  const submitLabel =
    surveyKind === "demographics"
      ? "Save and view phase instructions"
      : surveyKind === "overall"
        ? "Submit final survey"
        : "Submit and continue";

  return (
    <Box
      component="main"
      aria-labelledby="study-survey-title"
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: "auto",
        bgcolor: "background.default",
      }}
    >
      <Box
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{
          width: "min(1180px, calc(100% - 24px))",
          minHeight: "100%",
          mx: "auto",
          py: { xs: 1.5, md: 2 },
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <Typography
          variant="overline"
          color="primary"
          sx={{
            fontWeight: 700,
            letterSpacing: 1.1,
            fontSize: "0.7rem",
            lineHeight: 1.5,
          }}
        >
          {header.eyebrow}
        </Typography>
        <Typography
          id="study-survey-title"
          component="h1"
          variant="h3"
          sx={{
            fontWeight: 700,
            mt: 0.5,
            fontSize: { xs: "1.75rem", sm: "2.25rem" },
            lineHeight: 1.08,
          }}
        >
          {header.title}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 0.5, mb: 1.5 }}
        >
          {header.description}
        </Typography>

        {surveyKind === "demographics" && (
          <Paper
            variant="outlined"
            sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2, mb: 1.5 }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                gap: 1.5,
              }}
            >
              <TextField
                required
                size="small"
                type="number"
                label="What is your age?"
                value={age}
                onChange={(event) => setAge(event.target.value)}
                error={
                  attemptedSubmit &&
                  (!Number.isInteger(parsedAge) ||
                    parsedAge < 18 ||
                    parsedAge > 100)
                }
                helperText={
                  attemptedSubmit &&
                  (!Number.isInteger(parsedAge) ||
                    parsedAge < 18 ||
                    parsedAge > 100)
                    ? "Enter an age between 18 and 100."
                    : " "
                }
                inputProps={{ min: 18, max: 100 }}
              />
              <FormControl required error={attemptedSubmit && !gender}>
                <FormLabel>Please indicate your gender.</FormLabel>
                <Select
                  size="small"
                  value={gender}
                  displayEmpty
                  onChange={(event) => setGender(event.target.value)}
                  sx={{ mt: 0.5 }}
                >
                  <MenuItem value="" disabled>
                    Select an option
                  </MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Non-binary">Non-binary</MenuItem>
                  <MenuItem value="Prefer not to say">
                    Prefer not to say
                  </MenuItem>
                  <MenuItem value="Self-described">Self-described</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <FormControl
              required
              error={attemptedSubmit && !visualImpairments.trim()}
              fullWidth
              sx={{ mt: 1 }}
            >
              <FormLabel>
                Do you have any visual impairments (for example a color vision
                deficiency) that may affect your ability to participate in this
                study? If yes, please state the kind of visual impairment.
              </FormLabel>
              <TextField
                required
                fullWidth
                multiline
                minRows={1}
                maxRows={2}
                size="small"
                placeholder='For example, "No" or the kind of visual impairment.'
                value={visualImpairments}
                onChange={(event) => setVisualImpairments(event.target.value)}
                error={attemptedSubmit && !visualImpairments.trim()}
                helperText={
                  attemptedSubmit && !visualImpairments.trim()
                    ? 'Enter "No" if none apply.'
                    : " "
                }
                inputProps={{
                  "aria-label":
                    "Do you have any visual impairments (for example a color vision deficiency) that may affect your ability to participate in this study? If yes, please state the kind of visual impairment.",
                }}
                sx={{ mt: 0.5 }}
              />
            </FormControl>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
                gap: 2,
                mt: 1,
              }}
            >
              <LikertQuestion
                label="How much experience do you have in Reinforcement Learning/RLHF?"
                value={rlExperience}
                lowLabel="No experience"
                highLabel="Very experienced"
                error={attemptedSubmit && rlExperience === null}
                onChange={setRlExperience}
              />
              <LikertQuestion
                label="How much experience do you have with information visualization?"
                value={visualizationExperience}
                lowLabel="No experience"
                highLabel="Very experienced"
                error={attemptedSubmit && visualizationExperience === null}
                onChange={setVisualizationExperience}
              />
            </Box>
          </Paper>
        )}

        {surveyKind === "phase" && (
          <Paper
            variant="outlined"
            sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2, mb: 1.5 }}
          >
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              Section completed: <strong>{phaseLabel}</strong>
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <LikertQuestion
                label="The user interface is easy to use."
                value={interfaceEase}
                lowLabel="Strongly disagree"
                highLabel="Strongly agree"
                error={attemptedSubmit && interfaceEase === null}
                onChange={setInterfaceEase}
              />
              <LikertQuestion
                label="The generated feedback felt impactful."
                value={feedbackImpact}
                lowLabel="Strongly disagree"
                highLabel="Strongly agree"
                error={attemptedSubmit && feedbackImpact === null}
                onChange={setFeedbackImpact}
              />
              <LikertQuestion
                label="The feedback generation process was frustrating."
                value={feedbackFrustration}
                lowLabel="Strongly disagree"
                highLabel="Strongly agree"
                error={attemptedSubmit && feedbackFrustration === null}
                onChange={setFeedbackFrustration}
              />
            </Box>
          </Paper>
        )}

        {surveyKind === "overall" && (
          <Paper
            variant="outlined"
            sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 2, mb: 1.5 }}
          >
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  sm: "1fr 1fr",
                  lg: "1fr 1fr 1fr",
                },
                gap: 1.5,
              }}
            >
              {[
                {
                  label: "Which phases did you like the most?",
                  value: favoritePhase,
                  setter: setFavoritePhase,
                },
                {
                  label: "Which phases felt most impactful?",
                  value: mostImpactfulPhase,
                  setter: setMostImpactfulPhase,
                },
                {
                  label: "Which phases felt most transparent?",
                  value: mostTransparentPhase,
                  setter: setMostTransparentPhase,
                },
              ].map(({ label, value, setter }) => (
                <FormControl
                  key={label}
                  required
                  error={attemptedSubmit && !value}
                  fullWidth
                >
                  <FormLabel>{label}</FormLabel>
                  <Select
                    size="small"
                    value={value}
                    displayEmpty
                    onChange={(event) => setter(event.target.value)}
                    sx={{ mt: 0.5 }}
                  >
                    <MenuItem value="" disabled>
                      Select a phase
                    </MenuItem>
                    {phaseOptions.map((phase) => (
                      <MenuItem key={phase} value={phase}>
                        {phase}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ))}
            </Box>
            <FormControl fullWidth sx={{ mt: 1.5 }}>
              <FormLabel>
                Imagine you are tasked with collecting feedback for a domain
                application you are working on? Can you imagine to deploy a
                version of Visual Interactive Feedback Generation for this
                domain? (Optional)
              </FormLabel>
              <TextField
                fullWidth
                multiline
                minRows={2}
                maxRows={3}
                size="small"
                value={visualInteractiveDeployment}
                onChange={(event) =>
                  setVisualInteractiveDeployment(event.target.value)
                }
                inputProps={{
                  "aria-label":
                    "Imagine you are tasked with collecting feedback for a domain application you are working on? Can you imagine to deploy a version of Visual Interactive Feedback Generation for this domain? (Optional)",
                }}
                sx={{ mt: 0.5 }}
              />
            </FormControl>
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={3}
              size="small"
              label="Additional Comments"
              value={additionalComments}
              onChange={(event) => setAdditionalComments(event.target.value)}
              sx={{ mt: 1.25 }}
            />
          </Paper>
        )}

        {attemptedSubmit && !formValid && (
          <Alert severity="warning" sx={{ mb: 1 }}>
            Please answer all required questions before continuing.
          </Alert>
        )}
        {errorMessage && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {errorMessage}
          </Alert>
        )}
        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            display: "flex",
            justifyContent: "flex-end",
            py: 0.75,
            bgcolor: "background.default",
          }}
        >
          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            endIcon={<ArrowForwardIcon />}
          >
            {loading ? "Saving responses…" : submitLabel}
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default StudyPhaseSurveyScreen;
