import React from 'react';

type Episode = {
  env_name: string;
  benchmark_type: string;
  benchmark_id: number;
  checkpoint_step: number;
  episode_num: number;
};

type Target = {
  target_id: string;
  reference: Episode;
  timestamp: number;
  origin: string;
  step?: number;
  start?: number;
  end?: number;
};

// Using this enum is probably more robust than using strings. I am also using
// the convention that feedbacktypes correspond to the adjective used to
// describe the feedback type (e.g., evaluative feedback).
// Idea is good, but i would prefer to use a string, because it is more flexible
// in the frontend. In the backend, we do use the fixed enum.
enum FeedbackType {
  Evaluative = 'evaluative',
  Comparative = 'comparative',
  Corrective = 'corrective',
  Demonstrative = 'demonstrative',
  FeatureSelection = 'featureSelection',
  Textual = 'textual',
}

type Feedback = {
  feedback_type: FeedbackType;
  targets: Target[] | null;
  granularity: 'state' | 'episode' | 'segment' | 'entire';
  timestamp: number;
  session_id: string;

  // Optional additional fields
  [key: string]: unknown;
};

type Project = {
  id: number;
  project_name: string;
  project_experiments: string[];
};

type Experiment = {
  id: number;
  exp_name: string;
};

type SetupConfig = {
  // A map of enabled/disabled UI components
  id: number;
  name: string;
  description: string;
  uiComponents: {
    [key: string]: boolean;
  };
  feedbackComponents: {
    [key: string]: boolean;
  };
  max_ranking_elements: number;
  samplingStrategy: string;
  customInput: string;
};

type AppMode = 'study' | 'free';

type AppState = {
  // Drag and drop
  app_mode: AppMode;
  videoURLCache: {[key: string]: string};
  rewardsCache: {[key: string]: number[]};
  uncertaintyCache: {[key: string]: number[]};
  thumbnailURLCache: {[key: string]: string};
  status_bar_collapsed: boolean;
  modalOpen: boolean;
  startModalOpen: boolean;
  endModalOpen: boolean;
  projects: Project[];
  experiments: Experiment[];
  activeEnvId: string;
  actionLabels: any[];
  sessionId: string;
  filtered_experiments: Experiment[];
  selectedProject: Project;
  selectedExperiment: Experiment;
  sliderValue: number;
  rankeableEpisodeIDs: string[];
  ranks: {
    [key: string]: {
      rank: number;
      title: string;
      episodeItemIDs: string[];
    };
  };
  columnOrder: string[];
  episodeIDsChronologically: Episode[];
  activeEpisodes: Episode[];
  highlightedEpisodes: {value: number}[];
  allSetupConfigs: SetupConfig[];
  activeSetupConfig: SetupConfig;
  scheduledFeedback: Feedback[];
  currentStep: number;
  startModalContent: React.ReactNode | string | undefined;
  allThemes: string[];
  theme: string;
  isOnSubmit: boolean;
};

type AppProps = {};

export type {
  AppState,
  AppProps,
  Episode,
  Project,
  SetupConfig,
  Feedback,
  Experiment,
};
export {FeedbackType};
