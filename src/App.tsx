// App.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { Box, IconButton, Chip, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import HelpIcon from "@mui/icons-material/Help";

import axios from "axios";

import Menu from "./components/menubar/menu";
import ConfigModal from "./components/modals/ui-config-modal";
import BackendConfigModal from "./components/modals/backend-config-modal";
import ExperimentStartModal from "./components/modals/experiment-start-modal";
import ExperimentEndModal from "./components/modals/experiment-end-modal";
import FeedbackInterface from "./components/FeedbackInterface";
import ActiveLearningInterface from "./active_learning/ActiveLearningInterface";
import { OnboardingProvider } from "./active_learning/OnboardingSystem";
import { GetterContext } from "./getter-context";

import {
  AppStateProvider,
  useAppState,
  useAppDispatch,
} from "./AppStateContext";
import {
  SetupConfigProvider,
  useSetupConfigState,
  useSetupConfigDispatch,
} from "./SetupConfigContext";
import {
  ActiveLearningProvider
} from "./ActiveLearningContext";
import getDesignTokens from "./theme";
import { EpisodeFromID } from "./id";
import {
  AppMode,
  BackendConfig,
  UIConfig,
  SequenceElement,
  Feedback,
  FeedbackType,
} from "./types";
import { ShortcutsProvider } from "./ShortCutProvider";
import StudyCodeModal from "./components/modals/study-code-modal";
import StudyPhaseTransitionModal from "./components/modals/study-phase-transition-modal";

const DEFAULT_STUDY_SURVEY_URL =
  "https://docs.google.com/forms/d/e/1FAIpQLScE7s3EOEQL0p5Ky3B_S8gBYAx-FTCh4VucRNoY41an1nmMYw/viewform?usp=sf_link";

type ComparativePhaseKind = "baseline" | "mixed" | "active-learning";
type ComparativeStudyStage = "intro" | "between" | "complete";
type SampleSelectionMode = "first" | "random";
type RandomFn = () => number;

type ComparativeStudyPhase = {
  kind: ComparativePhaseKind;
  label: string;
  description: string;
  studyCode: string;
  appMode: "study" | "study-active-learning";
};

type LoadedSetupResult = {
  checkpoint: number | null;
};

const hashStringToSeed = (value: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const createSeededRandom = (seedInput: string): RandomFn => {
  let seed = hashStringToSeed(seedInput);
  if (seed === 0) {
    seed = 0x9e3779b9;
  }

  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleArray = <T,>(items: T[], random: RandomFn): T[] => {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
};

const normalizeSelectionMode = (value?: string): SampleSelectionMode => {
  if ((value ?? "").trim().toLowerCase() === "first") {
    return "first";
  }
  return "random";
};

const parseBatchSize = (uiConfig: UIConfig): number => {
  const parsed = Number.parseInt(String(uiConfig?.max_ranking_elements ?? 1), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }
  return parsed;
};

const buildBatchIndices = (
  startIndex: number,
  batchSize: number,
  limit: number,
  episodeCount: number,
): number[] => {
  const raw = Array.from({ length: batchSize }, (_, offset) => startIndex + offset).filter(
    (value) => value < limit,
  );
  if (episodeCount <= 0) {
    return [];
  }
  return raw.map((value) => value % episodeCount);
};

const buildRandomBatch = (
  batchSize: number,
  episodeCount: number,
  random: RandomFn,
): number[] => {
  if (episodeCount <= 0) {
    return [];
  }
  if (batchSize === 2 && episodeCount >= 2) {
    const first = Math.floor(random() * episodeCount);
    let second = Math.floor(random() * episodeCount);
    while (second === first) {
      second = Math.floor(random() * episodeCount);
    }
    return [first, second];
  }

  const available = Array.from({ length: episodeCount }, (_, index) => index);
  const batch: number[] = [];
  for (let i = 0; i < batchSize; i += 1) {
    if (available.length > 0) {
      const randomIndex = Math.floor(random() * available.length);
      batch.push(available.splice(randomIndex, 1)[0]);
    } else {
      batch.push(Math.floor(random() * episodeCount));
    }
  }
  return batch;
};

const buildConfigSequenceWithElementCounts = (
  uiConfigs: UIConfig[],
  elementCountByConfigId: Map<string, number>,
  mode: string,
  episodeCount: number,
  selectionMode: SampleSelectionMode = "first",
  random: RandomFn = Math.random,
): SequenceElement[] => {
  const result: SequenceElement[] = [];
  if (uiConfigs.length === 0 || episodeCount <= 0) {
    return result;
  }

  const pushBatchesSequentially = (configs: UIConfig[]) => {
    for (const uiConfig of configs) {
      const limit = Math.max(0, elementCountByConfigId.get(uiConfig.id) ?? 0);
      if (limit <= 0) {
        continue;
      }
      const batchSize = parseBatchSize(uiConfig);
      let cursor = 0;
      while (cursor < limit) {
        const batch =
          selectionMode === "random"
            ? buildRandomBatch(batchSize, episodeCount, random)
            : buildBatchIndices(cursor, batchSize, limit, episodeCount);
        if (!batch.length) {
          break;
        }
        result.push({
          uiConfig: { id: uiConfig.id, name: uiConfig.name },
          batch,
        });
        cursor += batchSize;
      }
    }
  };

  if (mode === "alternating") {
    const counters = uiConfigs.map(() => 0);
    const limits = uiConfigs.map((config) =>
      Math.max(0, elementCountByConfigId.get(config.id) ?? 0),
    );

    while (counters.some((cursor, index) => cursor < limits[index])) {
      for (let index = 0; index < uiConfigs.length; index += 1) {
        if (counters[index] >= limits[index]) {
          continue;
        }
        const uiConfig = uiConfigs[index];
        const batchSize = parseBatchSize(uiConfig);
        const batch =
          selectionMode === "random"
            ? buildRandomBatch(batchSize, episodeCount, random)
            : buildBatchIndices(
                counters[index],
                batchSize,
                limits[index],
                episodeCount,
              );
        if (!batch.length) {
          counters[index] = limits[index];
          continue;
        }
        result.push({
          uiConfig: { id: uiConfig.id, name: uiConfig.name },
          batch,
        });
        counters[index] += batchSize;
      }
    }

    return result;
  }

  if (mode === "random") {
    const shuffledConfigs = shuffleArray(uiConfigs, random);
    pushBatchesSequentially(shuffledConfigs);
    return result;
  }

  pushBatchesSequentially(uiConfigs);
  return result;
};

const buildDeterministicSequenceForSingleConfig = (
  uiConfig: UIConfig,
  episodeCount: number,
  targetInstances: number,
  selectionMode: SampleSelectionMode = "first",
  random: RandomFn = Math.random,
): SequenceElement[] => {
  const safeEpisodeCount = Math.max(1, episodeCount);
  const safeTargetInstances = Math.max(0, Math.floor(targetInstances));
  if (safeTargetInstances === 0) {
    return [];
  }

  const batchSize = parseBatchSize(uiConfig);

  if (batchSize === 2 && safeEpisodeCount >= 2) {
    const allPairs: number[][] = [];
    for (let i = 0; i < safeEpisodeCount; i += 1) {
      for (let j = i + 1; j < safeEpisodeCount; j += 1) {
        allPairs.push([i, j]);
      }
    }
    if (allPairs.length === 0) {
      return [];
    }
    const sourcePairs = selectionMode === "random" ? shuffleArray(allPairs, random) : allPairs;
    const chosenPairs: number[][] = sourcePairs.slice(
      0,
      Math.min(safeTargetInstances, sourcePairs.length),
    );
    while (chosenPairs.length < safeTargetInstances) {
      chosenPairs.push(sourcePairs[chosenPairs.length % sourcePairs.length]);
    }

    return chosenPairs.map((pair) => ({
      uiConfig: { id: uiConfig.id, name: uiConfig.name },
      batch: pair,
    }));
  }

  if (selectionMode === "random") {
    return Array.from({ length: safeTargetInstances }, () => ({
      uiConfig: { id: uiConfig.id, name: uiConfig.name },
      batch: buildRandomBatch(batchSize, safeEpisodeCount, random),
    }));
  }

  return Array.from({ length: safeTargetInstances }, (_, instanceIndex) => {
    const batch: number[] = [];
    const start = (instanceIndex * batchSize) % safeEpisodeCount;
    for (let i = 0; i < batchSize; i += 1) {
      batch.push((start + i) % safeEpisodeCount);
    }
    return {
      uiConfig: { id: uiConfig.id, name: uiConfig.name },
      batch,
    };
  });
};

const App: React.FC = () => {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const configState = useSetupConfigState();
  const configDispatch = useSetupConfigDispatch();
  const lastResetParamsRef = useRef<{
    experimentId: number;
    checkpoint: number | null;
    setupSignature: string;
  } | null>(null);
  const isApplyingSetupRef = useRef<boolean>(false);
  const projectionUncertaintyCacheRef = useRef<Map<string, Map<number, number[]>>>(
    new Map(),
  );
  const projectionUncertaintyPendingRef = useRef<
    Map<string, Promise<Map<number, number[]>>>
  >(new Map());
  const projectionRewardCacheRef = useRef<Map<string, Map<number, number[]>>>(
    new Map(),
  );
  const projectionRewardPendingRef = useRef<
    Map<string, Promise<Map<number, number[]>>>
  >(new Map());
  const projectionClusterCountCacheRef = useRef<Map<string, number>>(new Map());
  const projectionClusterCountPendingRef = useRef<Map<string, Promise<number>>>(
    new Map(),
  );
  const [comparativeStudyPhases, setComparativeStudyPhases] = useState<
    ComparativeStudyPhase[]
  >([]);
  const [comparativeStudyStage, setComparativeStudyStage] =
    useState<ComparativeStudyStage | null>(null);
  const [phaseTransitionModalOpen, setPhaseTransitionModalOpen] =
    useState<boolean>(false);
  const [phaseTransitionLoading, setPhaseTransitionLoading] =
    useState<boolean>(false);
  const [phaseTransitionError, setPhaseTransitionError] = useState<string | null>(
    null,
  );
  const [currentComparativePhaseIndex, setCurrentComparativePhaseIndex] =
    useState<number>(-1);
  const [nextComparativePhaseIndex, setNextComparativePhaseIndex] =
    useState<number>(-1);
  const [comparativeSurveyUrl, setComparativeSurveyUrl] = useState<string>(
    DEFAULT_STUDY_SURVEY_URL,
  );
  const [baselineSelectionMode, setBaselineSelectionMode] =
    useState<SampleSelectionMode>("random");
  const [mixedSelectionMode, setMixedSelectionMode] =
    useState<SampleSelectionMode>("random");
  const hasHandledPhaseEndRef = useRef<boolean>(false);
  const hasInitializedRef = useRef<boolean>(false);
  const isComparativeStudyMode = comparativeStudyPhases.length > 0;
  const currentComparativePhaseKind =
    isComparativeStudyMode && currentComparativePhaseIndex >= 0
      ? comparativeStudyPhases[currentComparativePhaseIndex]?.kind ?? "none"
      : "none";
  const currentSetupSignature = useMemo(() => {
    const selectedUiIds = (
      configState.activeBackendConfig.selectedUiConfigs ?? []
    )
      .map((config) => config.id)
      .join(",");
    return [
      configState.activeBackendConfig.id ?? "no-backend-id",
      configState.activeBackendConfig.samplingStrategy ?? "no-sampler",
      configState.activeBackendConfig.uiConfigMode ?? "no-mode",
      selectedUiIds || "no-selected-ui",
      currentComparativePhaseKind,
      baselineSelectionMode,
      mixedSelectionMode,
    ].join("::");
  }, [
    baselineSelectionMode,
    configState.activeBackendConfig.id,
    configState.activeBackendConfig.samplingStrategy,
    configState.activeBackendConfig.selectedUiConfigs,
    configState.activeBackendConfig.uiConfigMode,
    currentComparativePhaseKind,
    mixedSelectionMode,
  ]);

  const toNumberArray = useCallback((data: unknown): number[] => {
    if (Array.isArray(data)) {
      return data.map((value) => Number(value));
    }

    if (ArrayBuffer.isView(data)) {
      return Array.from(
        data as unknown as ArrayLike<number>,
        (value) => Number(value),
      );
    }

    if (data instanceof ArrayBuffer) {
      return Array.from(new Float32Array(data), (value) => Number(value));
    }

    return [];
  }, []);

  const getProjectionUncertaintyByEpisode = useCallback(
    async (episodeRef: ReturnType<typeof EpisodeFromID>) => {
      const cacheKey = `${episodeRef.benchmark_id}_${episodeRef.checkpoint_step}`;
      const cached = projectionUncertaintyCacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      const pending = projectionUncertaintyPendingRef.current.get(cacheKey);
      if (pending) {
        return pending;
      }

      const requestPromise = (async () => {
        const [projectionResponse, projectionDataResponse] = await Promise.all([
          axios.post("/projection/generate_projection", null, {
            params: {
              benchmark_id: episodeRef.benchmark_id,
              checkpoint_step: episodeRef.checkpoint_step,
            },
          }),
          axios.post("/projection/load_grid_projection_data", null, {
            params: {
              benchmark_id: episodeRef.benchmark_id,
              checkpoint_step: episodeRef.checkpoint_step,
              allow_missing: true,
            },
          }),
        ]);

        const projectionPayload = projectionResponse.data as {
          episode_indices?: unknown;
        };
        const predictionPayload = projectionDataResponse.data as {
          original_uncertainties?: unknown;
        };

        const episodeIndices = toNumberArray(projectionPayload.episode_indices);
        const originalUncertainties = toNumberArray(
          predictionPayload.original_uncertainties,
        );

        const byEpisode = new Map<number, number[]>();
        const sharedLength = Math.min(
          episodeIndices.length,
          originalUncertainties.length,
        );

        for (let i = 0; i < sharedLength; i += 1) {
          const rawEpisodeNum = episodeIndices[i];
          const rawUncertainty = originalUncertainties[i];
          if (!Number.isFinite(rawEpisodeNum) || !Number.isFinite(rawUncertainty)) {
            continue;
          }

          const episodeNum = Math.round(rawEpisodeNum);
          const currentValues = byEpisode.get(episodeNum) ?? [];
          currentValues.push(rawUncertainty);
          byEpisode.set(episodeNum, currentValues);
        }

        projectionUncertaintyCacheRef.current.set(cacheKey, byEpisode);
        return byEpisode;
      })()
        .catch((error) => {
          const emptyResult = new Map<number, number[]>();
          projectionUncertaintyCacheRef.current.set(cacheKey, emptyResult);

          if (!(axios.isAxiosError(error) && error.response?.status === 404)) {
            console.error(
              `Error loading projection uncertainty fallback for ${cacheKey}:`,
              error,
            );
          }

          return emptyResult;
        })
        .finally(() => {
          projectionUncertaintyPendingRef.current.delete(cacheKey);
        });

      projectionUncertaintyPendingRef.current.set(cacheKey, requestPromise);
      return requestPromise;
    },
    [toNumberArray],
  );

  const getProjectionRewardByEpisode = useCallback(
    async (episodeRef: ReturnType<typeof EpisodeFromID>) => {
      const cacheKey = `${episodeRef.benchmark_id}_${episodeRef.checkpoint_step}`;
      const cached = projectionRewardCacheRef.current.get(cacheKey);
      if (cached) {
        return cached;
      }

      const pending = projectionRewardPendingRef.current.get(cacheKey);
      if (pending) {
        return pending;
      }

      const requestPromise = (async () => {
        const [projectionResponse, projectionDataResponse] = await Promise.all([
          axios.post("/projection/generate_projection", null, {
            params: {
              benchmark_id: episodeRef.benchmark_id,
              checkpoint_step: episodeRef.checkpoint_step,
            },
          }),
          axios.post("/projection/load_grid_projection_data", null, {
            params: {
              benchmark_id: episodeRef.benchmark_id,
              checkpoint_step: episodeRef.checkpoint_step,
              allow_missing: true,
            },
          }),
        ]);

        const projectionPayload = projectionResponse.data as {
          episode_indices?: unknown;
        };
        const predictionPayload = projectionDataResponse.data as {
          original_predictions?: unknown;
        };

        const episodeIndices = toNumberArray(projectionPayload.episode_indices);
        const originalPredictions = toNumberArray(
          predictionPayload.original_predictions,
        );

        const byEpisode = new Map<number, number[]>();
        const sharedLength = Math.min(
          episodeIndices.length,
          originalPredictions.length,
        );

        for (let i = 0; i < sharedLength; i += 1) {
          const rawEpisodeNum = episodeIndices[i];
          const rawPrediction = originalPredictions[i];
          if (!Number.isFinite(rawEpisodeNum) || !Number.isFinite(rawPrediction)) {
            continue;
          }

          const episodeNum = Math.round(rawEpisodeNum);
          const currentValues = byEpisode.get(episodeNum) ?? [];
          currentValues.push(rawPrediction);
          byEpisode.set(episodeNum, currentValues);
        }

        projectionRewardCacheRef.current.set(cacheKey, byEpisode);
        return byEpisode;
      })()
        .catch((error) => {
          const emptyResult = new Map<number, number[]>();
          projectionRewardCacheRef.current.set(cacheKey, emptyResult);

          if (!(axios.isAxiosError(error) && error.response?.status === 404)) {
            console.error(
              `Error loading projection reward fallback for ${cacheKey}:`,
              error,
            );
          }

          return emptyResult;
        })
        .finally(() => {
          projectionRewardPendingRef.current.delete(cacheKey);
        });

      projectionRewardPendingRef.current.set(cacheKey, requestPromise);
      return requestPromise;
    },
    [toNumberArray],
  );

  const getProjectionClusterCount = useCallback(
    async (
      benchmarkId: number,
      checkpointStep: number,
      maxEpisodeCount: number,
    ): Promise<number> => {
      const safeEpisodeLimit = Math.max(1, Math.floor(maxEpisodeCount));
      const cacheKey = `${benchmarkId}_${checkpointStep}_${safeEpisodeLimit}`;
      const cached = projectionClusterCountCacheRef.current.get(cacheKey);
      if (cached !== undefined) {
        return cached;
      }

      const pending = projectionClusterCountPendingRef.current.get(cacheKey);
      if (pending) {
        return pending;
      }

      const requestPromise = axios
        .post("/projection/generate_projection", null, {
          params: {
            benchmark_id: benchmarkId,
            checkpoint_step: checkpointStep,
            projection_method: "PCA",
            sequence_length: 5,
          },
        })
        .then((response) => {
          const payload = response.data as { labels?: unknown[]; episode_indices?: unknown[] };
          const labels = Array.isArray(payload.labels) ? payload.labels : [];
          const episodeIndices = Array.isArray(payload.episode_indices)
            ? payload.episode_indices
            : [];

          const uniqueLabels = new Set<string>();
          if (labels.length > 0 && episodeIndices.length === labels.length) {
            for (let i = 0; i < labels.length; i += 1) {
              const episodeIndex = Number(episodeIndices[i]);
              if (!Number.isFinite(episodeIndex)) {
                continue;
              }
              if (episodeIndex < 0 || episodeIndex >= safeEpisodeLimit) {
                continue;
              }
              const labelEntry = labels[i];
              const labelValue = Array.isArray(labelEntry) ? labelEntry[0] : labelEntry;
              uniqueLabels.add(String(labelValue));
            }
          } else {
            for (const labelEntry of labels) {
              const labelValue = Array.isArray(labelEntry) ? labelEntry[0] : labelEntry;
              uniqueLabels.add(String(labelValue));
            }
          }

          const count = uniqueLabels.size;
          projectionClusterCountCacheRef.current.set(cacheKey, count);
          return count;
        })
        .catch((error) => {
          console.warn(
            `Could not determine projection cluster count for ${cacheKey}, falling back to episode count.`,
            error,
          );
          projectionClusterCountCacheRef.current.set(cacheKey, 0);
          return 0;
        })
        .finally(() => {
          projectionClusterCountPendingRef.current.delete(cacheKey);
        });

      projectionClusterCountPendingRef.current.set(cacheKey, requestPromise);
      return requestPromise;
    },
    [],
  );

  const buildComparativeStudyFromUrl = useCallback((url: URL) => {
    const getParamValue = (keys: string[]): string => {
      for (const key of keys) {
        const value = url.searchParams.get(key)?.trim();
        if (value) {
          return value;
        }
      }
      return "";
    };

    const baselineCode = getParamValue([
      "study_baseline",
      "baseline_study",
      "study_baseline_code",
    ]);
    const mixedCode = getParamValue([
      "study_mixed",
      "mixed_study",
      "study_alternating",
    ]);
    const activeLearningCode = getParamValue([
      "study_active",
      "active_study",
      "study_active_learning",
    ]);

    if (!baselineCode || !mixedCode || !activeLearningCode) {
      return null;
    }

    const surveyUrl =
      getParamValue(["survey_url", "study_survey"]) || DEFAULT_STUDY_SURVEY_URL;
    const sharedSelectionMode = getParamValue(["selection_mode", "sampling_mode"]);
    const baselineSelectionRaw =
      getParamValue(["baseline_selection_mode", "baseline_sampling_mode"]) ||
      sharedSelectionMode;
    const mixedSelectionRaw =
      getParamValue(["mixed_selection_mode", "mixed_sampling_mode"]) ||
      sharedSelectionMode;

    const basePhases: ComparativeStudyPhase[] = [
      {
        kind: "baseline",
        label: "Preference-Only Baseline",
        description:
          "Simple baseline interface with comparative preference feedback only.",
        studyCode: baselineCode,
        appMode: "study",
      },
      {
        kind: "mixed",
        label: "Mixed Feedback (Alternating)",
        description:
          "Baseline interface with backend-configured mixed feedback types (for example alternating).",
        studyCode: mixedCode,
        appMode: "study",
      },
      {
        kind: "active-learning",
        label: "Full Active Learning Interface",
        description:
          "Complete active-learning workflow with the expanded annotation and training loop.",
        studyCode: activeLearningCode,
        appMode: "study-active-learning",
      },
    ];

    const storageKey = `comparative-study-order:${baselineCode}:${mixedCode}:${activeLearningCode}`;
    let orderedPhases = basePhases;

    try {
      const savedOrderRaw = window.sessionStorage.getItem(storageKey);
      if (savedOrderRaw) {
        const parsedOrder = JSON.parse(savedOrderRaw) as ComparativePhaseKind[];
        const phasesByKind = new Map(
          basePhases.map((phase) => [phase.kind, phase] as const),
        );
        const restoredPhases = parsedOrder
          .map((kind) => phasesByKind.get(kind))
          .filter((phase): phase is ComparativeStudyPhase => Boolean(phase));
        if (restoredPhases.length === basePhases.length) {
          orderedPhases = restoredPhases;
        }
      } else {
        orderedPhases = shuffleArray(basePhases, Math.random);
        window.sessionStorage.setItem(
          storageKey,
          JSON.stringify(orderedPhases.map((phase) => phase.kind)),
        );
      }
    } catch (error) {
      console.warn("Could not persist randomized comparative study order:", error);
      orderedPhases = shuffleArray(basePhases, Math.random);
    }

    return {
      orderedPhases,
      surveyUrl,
      baselineSelectionMode: normalizeSelectionMode(baselineSelectionRaw),
      mixedSelectionMode: normalizeSelectionMode(mixedSelectionRaw),
    };
  }, []);

  useEffect(() => {
    if (hasInitializedRef.current) {
      return;
    }
    hasInitializedRef.current = true;

    const initializeData = () => {
      const url = new URL(window.location.href);
      const comparativeStudy = buildComparativeStudyFromUrl(url);

      if (comparativeStudy) {
        setComparativeStudyPhases(comparativeStudy.orderedPhases);
        setComparativeSurveyUrl(comparativeStudy.surveyUrl);
        setBaselineSelectionMode(comparativeStudy.baselineSelectionMode);
        setMixedSelectionMode(comparativeStudy.mixedSelectionMode);
        setCurrentComparativePhaseIndex(-1);
        setNextComparativePhaseIndex(0);
        setComparativeStudyStage("intro");
        setPhaseTransitionError(null);
        setPhaseTransitionModalOpen(true);
        dispatch({ type: "SET_START_MODAL_OPEN", payload: false });
        dispatch({ type: "SET_APP_MODE", payload: "study" });
      } else {
        const study_mode = url.searchParams.get("study_mode") || "";
        const study_code = url.searchParams.get("study") || "";
        if (study_mode === "active-learning") {
          if (study_code !== "") {
            dispatch({ type: "SET_STUDY_CODE", payload: study_code });
            dispatch({ type: "SET_APP_MODE", payload: "study-active-learning" });
          } else {
            dispatch({ type: "SET_APP_MODE", payload: "active-learning" });
          }
          //dispatch({ type: "TOGGLE_STATUS_BAR" });
        } else {
          if (study_code !== "") {
            dispatch({ type: "SET_STUDY_CODE", payload: study_code });
            dispatch({ type: "SET_APP_MODE", payload: "study" });
          } else {
            dispatch({ type: "SET_APP_MODE", payload: "configure" });
            dispatch({ type: "TOGGLE_STATUS_BAR" });
          }
        }
      }

      // Fetch Projects, Experiments, UI Configs, Backend Configs
      axios.get("/get_all?model_name=project").then((res) => {
        dispatch({ type: "SET_PROJECTS", payload: res.data });
      });

      axios.get("/get_all?model_name=experiment").then((res) => {
        dispatch({ type: "SET_EXPERIMENTS", payload: res.data });
      });

      axios.get("/ui_configs").then((res) => {
        configDispatch({ type: "SET_ALL_UI_CONFIGS", payload: res.data });
      });

      axios.get("/backend_configs").then((res) => {
        configDispatch({ type: "SET_ALL_BACKEND_CONFIGS", payload: res.data });
      });
    };

    initializeData();
  }, [buildComparativeStudyFromUrl, configDispatch, dispatch]);

  const handleToggleStatusBar = () => {
    dispatch({ type: "TOGGLE_STATUS_BAR" });
  };

  const closeUIConfigModal = (config: UIConfig | null) => {
    if (config) {
      // Set config ID to a random placeholder ID (will be updated on the backend)
      config.id = "ui" + Date.now().toString();
      // update the list of UI configs and set the active config
      configDispatch({
        type: "SET_ALL_UI_CONFIGS",
        payload: [...configState.allUIConfigs, config],
      });
      axios.post("/save_ui_config", config).then(() => {
        console.log("Config saved for study");
      });
    }
    dispatch({ type: "SET_UI_CONFIG_MODAL_OPEN", payload: false });
  };

  const closeBackendConfigModal = (config: BackendConfig | null) => {
    if (config) {
      // Set config ID to the next available ID
      config.id = "backend" + Date.now().toString();
      // update the list of Backend configs
      configDispatch({
        type: "SET_ALL_BACKEND_CONFIGS",
        payload: [...configState.allBackendConfigs, config],
      });
      // Save the config to the backend
      axios.post("/save_backend_config", config).then(() => {
        console.log("Config saved for backend");
      });
    }
    dispatch({ type: "SET_BACKEND_CONFIG_MODAL_OPEN", payload: false });
  };

  // Moved Getter Functions
  const getVideoURL = useCallback(
    async (episodeId: string) => {
      if (state.videoURLCache[episodeId]) {
        return state.videoURLCache[episodeId];
      }
      try {
        const response = await axios.get("data/get_video", {
          params: EpisodeFromID(episodeId),
          responseType: "blob",
        });
        const url = URL.createObjectURL(response.data);
        dispatch({
          type: "SET_VIDEO_URL_CACHE",
          payload: { [episodeId]: url },
        });
        return url;
      } catch (error) {
        console.error("Error fetching video URL:", error);
      }
      return undefined;
    },
    [dispatch, state.videoURLCache],
  );

  const getThumbnailURL = useCallback(
    async (episodeId: string) => {
      if (state.thumbnailURLCache[episodeId]) {
        return state.thumbnailURLCache[episodeId];
      }
      try {
        const response = await axios.get("data/get_thumbnail", {
          params: EpisodeFromID(episodeId),
          responseType: "blob",
        });
        const url = URL.createObjectURL(response.data);
        dispatch({
          type: "SET_THUMBNAIL_URL_CACHE",
          payload: { [episodeId]: url },
        });
        return url;
      } catch (error) {
        console.error("Error fetching thumbnail URL:", error);
      }
      return undefined;
    },
    [state.thumbnailURLCache, dispatch],
  );

  const getRewards = useCallback(
    async (episodeId: string) => {
      if (state.rewardsCache[episodeId]) {
        return state.rewardsCache[episodeId];
      }

      try {
        const episodeRef = EpisodeFromID(episodeId);
        const byEpisode = await getProjectionRewardByEpisode(episodeRef);
        const predictedRewards = byEpisode.get(episodeRef.episode_num);

        if (predictedRewards && predictedRewards.length > 0) {
          dispatch({
            type: "SET_REWARDS_CACHE",
            payload: { [episodeId]: predictedRewards },
          });
          return predictedRewards;
        }
      } catch (error) {
        console.warn("Projection reward fetch failed, falling back to file rewards:", error);
      }

      try {
        const response = await axios.get("data/get_rewards", {
          params: EpisodeFromID(episodeId),
        });
        const rewards = toNumberArray(response.data).filter((v) => Number.isFinite(v));
        dispatch({
          type: "SET_REWARDS_CACHE",
          payload: { [episodeId]: rewards },
        });
        return rewards;
      } catch (error) {
        console.error("Error fetching rewards:", error);
      }
      return undefined;
    },
    [state.rewardsCache, dispatch, getProjectionRewardByEpisode, toNumberArray],
  );

  const getUncertainty = useCallback(
    async (episodeId: string) => {
      if (state.uncertaintyCache[episodeId]) {
        return state.uncertaintyCache[episodeId];
      }

      try {
        const episodeRef = EpisodeFromID(episodeId);
        const byEpisode = await getProjectionUncertaintyByEpisode(episodeRef);
        const predictedUncertainty = byEpisode.get(episodeRef.episode_num);

        if (predictedUncertainty && predictedUncertainty.length > 0) {
          dispatch({
            type: "SET_UNCERTAINTY_CACHE",
            payload: { [episodeId]: predictedUncertainty },
          });
          return predictedUncertainty;
        }
      } catch (error) {
        console.warn("Projection uncertainty fetch failed, falling back to file uncertainty:", error);
      }

      try {
        const response = await axios.get("data/get_uncertainty", {
          params: EpisodeFromID(episodeId),
        });
        const uncertainty = toNumberArray(response.data).filter((v) =>
          Number.isFinite(v),
        );
        if (uncertainty.length === 0) {
          throw new Error("Empty uncertainty payload from /data/get_uncertainty");
        }
        dispatch({
          type: "SET_UNCERTAINTY_CACHE",
          payload: { [episodeId]: uncertainty },
        });
        return uncertainty;
      } catch (error) {
        console.error("Error fetching uncertainty:", error);
      }
      return undefined;
    },
    [state.uncertaintyCache, dispatch, toNumberArray, getProjectionUncertaintyByEpisode],
  );

  const getterContextValue = useMemo(
    () => ({
      getVideoURL,
      getThumbnailURL,
      getRewards,
      getUncertainty,
    }),
    [getVideoURL, getThumbnailURL, getRewards, getUncertainty],
  );

  // Fetch action labels
  const getActionLabels = useCallback(async (envId: string) => {
    try {
      const response = await axios.post("/data/get_action_label_urls", {
        envId,
      });
      dispatch({ type: "SET_ACTION_LABELS", payload: response.data });
    } catch (error) {
      console.error("Error fetching action labels:", error);
    }
  }, [dispatch]);

  const generateUiConfigSequence = useCallback(async (episodes: any[]) => {
    const selectedUiConfigs = configState.activeBackendConfig.selectedUiConfigs;
    const selectedUiConfigIdsKey = selectedUiConfigs
      .map((config) => config.id)
      .join(",");
    let uiConfigSequence: SequenceElement[] = [];
    const fallbackUiConfig = configState.activeUIConfig;
    let resolvedAllUiConfigs = configState.allUIConfigs;
    const episodeCount = Math.max(episodes.length || 0, 1);
    const sampledEpisodeCount = Math.min(episodeCount, 10);
    const mode =
      selectedUiConfigs.length === 0
        ? "sequential"
        : configState.activeBackendConfig.uiConfigMode;
    let relevantUiConfigs: UIConfig[] = [];
    const activeComparativePhaseKind =
      currentComparativePhaseKind !== "none"
        ? currentComparativePhaseKind
        : null;
    const episodeSeedKey = episodes
      .slice(0, sampledEpisodeCount)
      .map((episode, index) => {
        if (typeof episode === "string" || typeof episode === "number") {
          return String(episode);
        }
        if (episode && typeof episode === "object") {
          const candidate = episode as {
            id?: string | number;
            episode_id?: string | number;
          };
          if (candidate.episode_id !== undefined) {
            return String(candidate.episode_id);
          }
          if (candidate.id !== undefined) {
            return String(candidate.id);
          }
        }
        return String(index);
      })
      .join("|");
    const sequenceSeed = [
      String(state.selectedExperiment.id),
      String(state.selectedCheckpoint),
      currentComparativePhaseKind,
      configState.activeBackendConfig.id || "no-backend-id",
      configState.activeBackendConfig.uiConfigMode || "no-ui-mode",
      selectedUiConfigIdsKey || "no-selected-ui",
      baselineSelectionMode,
      mixedSelectionMode,
      String(sampledEpisodeCount),
      episodeSeedKey || "no-episodes",
    ].join("::");
    const seededRandom = createSeededRandom(sequenceSeed);

    if (selectedUiConfigs.length > 0) {
      const selectedUiConfigIds = selectedUiConfigs.map((config) => config.id);
      const hasAllSelectedUiConfigs =
        selectedUiConfigIds.length === 0 ||
        selectedUiConfigIds.every((id) =>
          resolvedAllUiConfigs.some((config) => config.id === id),
        );

      if (!hasAllSelectedUiConfigs) {
        try {
          const uiConfigsResponse = await axios.get("/ui_configs");
          const fetchedUiConfigs = Array.isArray(uiConfigsResponse.data)
            ? uiConfigsResponse.data
            : [];
          if (fetchedUiConfigs.length > 0) {
            resolvedAllUiConfigs = fetchedUiConfigs;
            configDispatch({
              type: "SET_ALL_UI_CONFIGS",
              payload: fetchedUiConfigs,
            });
          }
        } catch (error) {
          console.warn("Could not refresh UI configs before sequence generation:", error);
        }
      }
    }

    if (selectedUiConfigs.length === 0) {
      const relevantUiConfigsFromList = resolvedAllUiConfigs.filter(
        (c) => c.id === configState.activeUIConfig.id,
      );
      relevantUiConfigs =
        relevantUiConfigsFromList.length > 0
          ? relevantUiConfigsFromList
          : [fallbackUiConfig];
    } else {
      const relevantUiConfigsFromList = resolvedAllUiConfigs.filter((c) =>
        selectedUiConfigs.map((c) => c.id).includes(c.id),
      );
      relevantUiConfigs =
        relevantUiConfigsFromList.length > 0
          ? relevantUiConfigsFromList
          : [fallbackUiConfig];
    }

    if (
      activeComparativePhaseKind === "baseline" &&
      relevantUiConfigs.length === 1
    ) {
      uiConfigSequence = buildDeterministicSequenceForSingleConfig(
        relevantUiConfigs[0],
        sampledEpisodeCount,
        6,
        baselineSelectionMode,
        seededRandom,
      );
      await configDispatch({
        type: "SET_UI_CONFIG_SEQUENCE",
        payload: uiConfigSequence,
      });
      return;
    }

    if (activeComparativePhaseKind === "mixed" && relevantUiConfigs.length > 0) {
      const fixedCountByConfig = new Map<string, number>();
      for (const uiConfig of relevantUiConfigs) {
        const batchSize = parseBatchSize(uiConfig);
        fixedCountByConfig.set(uiConfig.id, Math.max(1, batchSize) * 2);
      }
      uiConfigSequence = buildConfigSequenceWithElementCounts(
        relevantUiConfigs,
        fixedCountByConfig,
        mode,
        sampledEpisodeCount,
        mixedSelectionMode,
        seededRandom,
      );
      await configDispatch({
        type: "SET_UI_CONFIG_SEQUENCE",
        payload: uiConfigSequence,
      });
      return;
    }

    const elementCountByConfigId = new Map<string, number>();
    await Promise.all(
      relevantUiConfigs.map(async (uiConfig) => {
        let elementCount = episodeCount;
        if (uiConfig.feedbackComponents.clusterRating) {
          const checkpointStep = Number(state.selectedCheckpoint);
          if (
            Number.isFinite(checkpointStep) &&
            Number.isFinite(state.selectedExperiment.id) &&
            state.selectedExperiment.id !== -1
          ) {
            const clusterCount = await getProjectionClusterCount(
              state.selectedExperiment.id,
              checkpointStep,
              episodeCount,
            );
            if (clusterCount > 0) {
              elementCount = Math.min(clusterCount, sampledEpisodeCount);
            }
          }
        }
        elementCountByConfigId.set(uiConfig.id, Math.max(1, elementCount));
      }),
    );

    uiConfigSequence = buildConfigSequenceWithElementCounts(
      relevantUiConfigs,
      elementCountByConfigId,
      mode,
      sampledEpisodeCount,
      "first",
      seededRandom,
    );

    await configDispatch({
      type: "SET_UI_CONFIG_SEQUENCE",
      payload: uiConfigSequence,
    });
  }, [
    configState.activeBackendConfig.selectedUiConfigs,
    configState.activeBackendConfig.id,
    configState.allUIConfigs,
    configState.activeUIConfig.id,
    configState.activeBackendConfig.uiConfigMode,
    getProjectionClusterCount,
    isComparativeStudyMode,
    currentComparativePhaseIndex,
    comparativeStudyPhases,
    currentComparativePhaseKind,
    baselineSelectionMode,
    mixedSelectionMode,
    configDispatch,
    state.selectedCheckpoint,
    state.selectedExperiment.id,
  ]);

  const getEpisodeIDsChronologically = useCallback(async () => {
    try {
      // Fetch episodes
      const response = await axios.get("/data/get_all_episodes");
      const episodes = response.data;

      // Update state with the fetched episodes
      await Promise.all([
        dispatch({
          type: "SET_EPISODE_IDS_CHRONOLOGICALLY",
          payload: episodes,
        }),
        dispatch({ type: "SET_CURRENT_STEP", payload: 0 }),
      ]);

      return episodes;
    } catch (error) {
      console.error("Error fetching episodes:", error);
      throw error; // Re-throw the error so the caller can handle it
    }
  }, [dispatch]);

  const resetSampler = useCallback(async () => {
    if (state.selectedExperiment.id === -1 || state.selectedCheckpoint === -1) {
      return;
    }

    // First reset the FeedbackInterface initialization if reset function exists
    if (state.feedbackInterfaceReset) {
      state.feedbackInterfaceReset();
    }

    try {
      projectionClusterCountCacheRef.current.clear();
      projectionClusterCountPendingRef.current.clear();
      projectionRewardCacheRef.current.clear();
      projectionRewardPendingRef.current.clear();

      const resetResponse = await axios.post(
        "/data/reset_sampler?experiment_id=" +
        state.selectedExperiment.id +
        "&sampling_strategy=" +
        configState.activeBackendConfig.samplingStrategy,
      );

      await dispatch({
        type: "SET_SESSION_ID",
        payload: resetResponse.data.session_id,
      });
      await dispatch({ type: "CLEAR_SCHEDULED_FEEDBACK" });

      // Log reset as meta feedback
      const resetFeedback: Feedback = {
        experiment_id: state.selectedExperiment.id,
        session_id: resetResponse.data.session_id,
        feedback_type: FeedbackType.Meta,
        granularity: "entire",
        timestamp: Date.now(),
        targets: [],
        meta_action: "reset",
      }
      axios.post("/data/give_feedback", [resetFeedback]);

      // Get episodes first and store the result
      const episodes = await getEpisodeIDsChronologically();

      // Generate UI config sequence with the fetched episodes
      await generateUiConfigSequence(episodes);

      // Fetch action labels
      await getActionLabels(resetResponse.data.environment_id);

      const checkpointNumber = Number(state.selectedCheckpoint);
      const checkpointValue = Number.isFinite(checkpointNumber)
        ? checkpointNumber
        : null;
      lastResetParamsRef.current = {
        experimentId: state.selectedExperiment.id,
        checkpoint: checkpointValue,
        setupSignature: currentSetupSignature,
      };
    } catch (error) {
      console.error("Error in resetSampler:", error);
    }
  }, [
    state.selectedExperiment.id,
    state.selectedCheckpoint,
    state.feedbackInterfaceReset,
    configState.activeBackendConfig.samplingStrategy,
    dispatch,
    generateUiConfigSequence,
    getEpisodeIDsChronologically,
    getActionLabels,
    currentSetupSignature,
  ]);

  const stepSampler = async () => {
    // Step sampler with current sessionID, but we set new episode data and clear feedback
    // submit step feedback
    if (state.selectedExperiment.id === -1) {
      return;
    }
    
    if (state.feedbackInterfaceReset) {
      state.feedbackInterfaceReset();
    }

    try {
      projectionClusterCountCacheRef.current.clear();
      projectionClusterCountPendingRef.current.clear();
      projectionRewardCacheRef.current.clear();
      projectionRewardPendingRef.current.clear();

      const stepResponse = await axios.post(
        "/data/step_sampler?session_id=" + state.sessionId + '&experiment_id=' +
          state.selectedExperiment.id
      );

      // Log step as meta feedback
      const stepFeedback: Feedback = {
        experiment_id: state.selectedExperiment.id,
        session_id: state.sessionId,
        feedback_type: FeedbackType.Meta,
        granularity: "entire",
        timestamp: Date.now(),
        targets: [],
        meta_action: "step",
      }
      axios.post("/data/give_feedback", [stepFeedback]);

      // Get episodes first and store the result
      const episodes = await getEpisodeIDsChronologically();

      // Generate UI config sequence with the fetched episodes
      await generateUiConfigSequence(episodes);

      // Fetch action labels
      //await getActionLabels(stepResponse.data.environment_id);
    } catch (error) {
      console.error("Error in stepSampler:", error);
    }
  };

  useEffect(() => {
    if (isApplyingSetupRef.current) {
      return;
    }

    const experimentId = state.selectedExperiment?.id ?? -1;
    if (experimentId === -1) {
      return;
    }

    const checkpointValue = Number.isFinite(state.selectedCheckpoint)
      ? state.selectedCheckpoint
      : null;

    const last = lastResetParamsRef.current;
    if (
      last &&
      last.experimentId === experimentId &&
      last.checkpoint === checkpointValue &&
      last.setupSignature === currentSetupSignature
    ) {
      return;
    }

    void resetSampler();
  }, [state.selectedExperiment.id, state.selectedCheckpoint, resetSampler, currentSetupSignature]);

  const loadStudySetup = useCallback(
    async (studyCode: string, appMode: AppMode): Promise<LoadedSetupResult> => {
      isApplyingSetupRef.current = true;
      let loadedCheckpoint: number | null = null;
      try {
        const res = await axios.post("/load_setup", {
          study_code: studyCode,
        });
        const data = res.data as Partial<{
          project: unknown;
          experiment: unknown;
          checkpoint: number | string;
          ui_config: UIConfig;
          backend_config: BackendConfig;
          message: string;
        }>;

        if (data.message === "Setup not found.") {
          throw new Error(`Setup '${studyCode}' not found.`);
        }
        if (!data.project || !data.experiment || data.checkpoint === undefined) {
          throw new Error(`Invalid setup payload for study '${studyCode}'.`);
        }

        let resolvedUiConfigs = [...configState.allUIConfigs];
        const selectedUiConfigIds =
          data.backend_config?.selectedUiConfigs?.map((uiConfig) => uiConfig.id) ?? [];
        const hasAllSelectedUiConfigs =
          selectedUiConfigIds.length === 0 ||
          selectedUiConfigIds.every((id) =>
            resolvedUiConfigs.some((config) => config.id === id),
          );
        if (resolvedUiConfigs.length === 0 || !hasAllSelectedUiConfigs) {
          const uiConfigsResponse = await axios.get("/ui_configs");
          resolvedUiConfigs = uiConfigsResponse.data;
          configDispatch({
            type: "SET_ALL_UI_CONFIGS",
            payload: resolvedUiConfigs,
          });
        }

        await dispatch({ type: "SET_STUDY_CODE", payload: studyCode });
        await dispatch({
          type: "SET_SELECTED_PROJECT",
          payload: data.project,
        });
        await dispatch({
          type: "SET_SELECTED_EXPERIMENT",
          payload: data.experiment,
        });
        await dispatch({
          type: "SET_SELECTED_CHECKPOINT",
          payload: Number(data.checkpoint),
        });
        const parsedCheckpoint = Number(data.checkpoint);
        loadedCheckpoint = Number.isFinite(parsedCheckpoint) ? parsedCheckpoint : null;
        if (data.ui_config) {
          const hasUiConfig = resolvedUiConfigs.some(
            (cfg) => cfg.id === data.ui_config?.id,
          );
          if (!hasUiConfig) {
            resolvedUiConfigs = [...resolvedUiConfigs, data.ui_config];
            configDispatch({
              type: "SET_ALL_UI_CONFIGS",
              payload: resolvedUiConfigs,
            });
          }
          await configDispatch({
            type: "SET_ACTIVE_UI_CONFIG",
            payload: data.ui_config,
          });
        }
        if (data.backend_config) {
          const hasBackendConfig = configState.allBackendConfigs.some(
            (cfg) => cfg.id === data.backend_config?.id,
          );
          if (!hasBackendConfig) {
            configDispatch({
              type: "SET_ALL_BACKEND_CONFIGS",
              payload: [...configState.allBackendConfigs, data.backend_config],
            });
          }
          await configDispatch({
            type: "SET_ACTIVE_BACKEND_CONFIG",
            payload: data.backend_config,
          });
        }

        // Switch app mode only after project/experiment/checkpoint/config are set.
        // This avoids mounting the active-learning view with a stale checkpoint.
        await dispatch({ type: "SET_APP_MODE", payload: appMode });

        // Let setup-config reducer updates settle before triggering setup-complete reset.
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });

        // Force a sampler reset even when consecutive phases share experiment/checkpoint.
        lastResetParamsRef.current = null;
        await dispatch({ type: "SET_SETUP_COMPLETE", payload: true });
        return { checkpoint: loadedCheckpoint };
      } finally {
        isApplyingSetupRef.current = false;
      }
    },
    [configDispatch, configState.allBackendConfigs, configState.allUIConfigs, dispatch],
  );

  const handleExperimentStartClose = async () => {
    if (
      (state.app_mode === "study" || state.app_mode === "study-active-learning") &&
      state.studyCode
    ) {
      try {
        const mode: AppMode =
          state.app_mode === "study-active-learning"
            ? "study-active-learning"
            : "study";
        await loadStudySetup(state.studyCode, mode);
      } catch (error) {
        console.error("Error loading setup:", error);
      }
    }
  };

  const startComparativePhase = useCallback(
    async (phaseIndex: number) => {
      const phase = comparativeStudyPhases[phaseIndex];
      if (!phase) {
        setPhaseTransitionError("Could not find the selected phase.");
        return;
      }

      setPhaseTransitionLoading(true);
      setPhaseTransitionError(null);

      const previousPhaseIndex = currentComparativePhaseIndex;
      setCurrentComparativePhaseIndex(phaseIndex);

      try {
        const loadedSetup = await loadStudySetup(phase.studyCode, phase.appMode);
        if (loadedSetup.checkpoint !== null) {
          await dispatch({
            type: "SET_SELECTED_CHECKPOINT",
            payload: loadedSetup.checkpoint,
          });
        }
        await dispatch({ type: "SET_START_MODAL_OPEN", payload: false });
        if (state.endModalOpen) {
          await dispatch({ type: "SET_END_MODAL_OPEN" });
        }
        hasHandledPhaseEndRef.current = false;
        setNextComparativePhaseIndex(-1);
        setComparativeStudyStage(null);
        setPhaseTransitionModalOpen(false);
      } catch (error) {
        setCurrentComparativePhaseIndex(previousPhaseIndex);
        const message = error instanceof Error ? error.message : String(error);
        setPhaseTransitionError(`Could not load phase setup: ${message}`);
      } finally {
        setPhaseTransitionLoading(false);
      }
    },
    [
      comparativeStudyPhases,
      currentComparativePhaseIndex,
      dispatch,
      loadStudySetup,
      state.endModalOpen,
    ],
  );

  const handlePhaseTransitionContinue = useCallback(() => {
    if (comparativeStudyStage === "complete") {
      setPhaseTransitionModalOpen(false);
      return;
    }

    if (nextComparativePhaseIndex < 0) {
      return;
    }

    void startComparativePhase(nextComparativePhaseIndex);
  }, [
    comparativeStudyStage,
    nextComparativePhaseIndex,
    startComparativePhase,
  ]);

  useEffect(() => {
    if (!isComparativeStudyMode) {
      return;
    }

    if (!state.endModalOpen) {
      hasHandledPhaseEndRef.current = false;
      return;
    }

    if (currentComparativePhaseIndex < 0 || hasHandledPhaseEndRef.current) {
      return;
    }

    hasHandledPhaseEndRef.current = true;
    const nextIndex = currentComparativePhaseIndex + 1;
    const currentPhase = comparativeStudyPhases[currentComparativePhaseIndex];

    const handleComparativePhaseEnd = async () => {
      await dispatch({ type: "SET_END_MODAL_OPEN" });
      if (currentPhase && currentPhase.kind !== "active-learning") {
        const checkpoints = state.selectedExperiment.checkpoint_list ?? [];
        const currentCheckpoint = String(state.selectedCheckpoint);
        const currentCheckpointIndex = checkpoints.findIndex(
          (checkpoint) => String(checkpoint) === currentCheckpoint,
        );
        const hasNextCheckpoint =
          currentCheckpointIndex >= 0 &&
          currentCheckpointIndex < checkpoints.length - 1;

        if (hasNextCheckpoint) {
          const nextCheckpoint = Number(checkpoints[currentCheckpointIndex + 1]);
          if (Number.isFinite(nextCheckpoint)) {
            await dispatch({
              type: "SET_SELECTED_CHECKPOINT",
              payload: nextCheckpoint,
            });
            hasHandledPhaseEndRef.current = false;
            return;
          }
        }
      }

      setPhaseTransitionError(null);
      if (nextIndex < comparativeStudyPhases.length) {
        setNextComparativePhaseIndex(nextIndex);
        setComparativeStudyStage("between");
      } else {
        setNextComparativePhaseIndex(-1);
        setComparativeStudyStage("complete");
      }
      setPhaseTransitionModalOpen(true);
    };

    void handleComparativePhaseEnd();
  }, [
    comparativeStudyPhases,
    currentComparativePhaseIndex,
    dispatch,
    isComparativeStudyMode,
    state.endModalOpen,
    state.selectedCheckpoint,
    state.selectedExperiment.checkpoint_list,
  ]);

  useEffect(() => {
    if (!state.setupComplete) {
      return;
    }

    const experimentId = state.selectedExperiment?.id ?? -1;
    const checkpointValue = Number.isFinite(state.selectedCheckpoint)
      ? state.selectedCheckpoint
      : null;
    const last = lastResetParamsRef.current;

    if (experimentId !== -1) {
      if (
        !last ||
        last.experimentId !== experimentId ||
        last.checkpoint !== checkpointValue ||
        last.setupSignature !== currentSetupSignature
      ) {
        void resetSampler();
      }
    }

    dispatch({ type: "SET_SETUP_COMPLETE", payload: false });
  }, [
    state.setupComplete,
    state.selectedExperiment.id,
    state.selectedCheckpoint,
    dispatch,
    resetSampler,
    currentSetupSignature,
  ]);

  const upcomingComparativePhase =
    nextComparativePhaseIndex >= 0
      ? comparativeStudyPhases[nextComparativePhaseIndex]
      : undefined;
  const upcomingComparativePhaseNumber =
    nextComparativePhaseIndex >= 0 ? nextComparativePhaseIndex + 1 : undefined;

  return (
    <ThemeProvider
      theme={createTheme(getDesignTokens(state.theme as "light" | "dark"))}
    >
      <GetterContext.Provider value={getterContextValue}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100vh",
            width: "100vw",
          }}
        >
          <Box
            id="menu"
            sx={{
              flexDirection: "column",
              bgcolor: createTheme(
                getDesignTokens(state.theme as "light" | "dark"),
              ).palette.background.l0,
            }}
          >
            <Menu resetSampler={resetSampler} />
            <Box sx={{ display: "flex", flexDirection: "row" }}>
              <IconButton
                disabled={state.app_mode === "study"}
                onClick={handleToggleStatusBar}
              >
                {state.status_bar_collapsed ? (
                  <ExpandMoreIcon />
                ) : (
                  <ExpandLessIcon />
                )}
              </IconButton>
              <Chip
                label={
                  state.sessionId !== "-" ? "Status: Active" : "Status: Waiting"
                }
                color={state.sessionId !== "-" ? "success" : "info"}
                sx={{
                  marginTop: "0.5vh",
                  float: "right",
                }}
              />
              {state.status_bar_collapsed && (
                <>
                  <Typography
                    sx={{
                      fontWeight: "bold",
                      margin: "auto",
                      float: "right",
                      color: createTheme(
                        getDesignTokens(state.theme as "light" | "dark"),
                      ).palette.text.primary,
                    }}
                  >
                    Active Feedback Generation for RL
                  </Typography>
                  <IconButton
                    onClick={() =>
                      dispatch({ type: "SET_START_MODAL_OPEN", payload: true })
                    }
                    sx={{ marginTop: "0.2vh", marginRight: "20px", float: "right" }}
                  >
                    <HelpIcon />
                  </IconButton>
                
                </>
              )}
            </Box>
          </Box>
          {state.app_mode === "active-learning" || state.app_mode === "study-active-learning" ? (
            <ActiveLearningProvider>
              <OnboardingProvider>
                <>
                  <ActiveLearningInterface stepSampler={stepSampler} />
                  <ExperimentStartModal onClose={handleExperimentStartClose} />
                  {!isComparativeStudyMode && (
                    <ExperimentEndModal open={state.endModalOpen} />
                  )}
                </>
              </OnboardingProvider>
            </ActiveLearningProvider>
          ) : (
            state.selectedProject?.id >= 0 ? <FeedbackInterface /> : null
          )}
          <ConfigModal
            config={configState.activeUIConfig}
            open={state.uiConfigModalOpen}
            onClose={closeUIConfigModal}
          />
          <BackendConfigModal
            config={configState.activeBackendConfig}
            uiConfigList={configState.allUIConfigs}
            open={state.backendConfigModalOpen}
            onClose={closeBackendConfigModal}
          />
          {/*<ShortcutsInfoBox />*/}
          <StudyCodeModal
            open={state.showStudyCode}
            onClose={() => dispatch({ type: "TOGGLE_STUDY_CODE" })}
            studyCode={state.studyCode}
          />
          {isComparativeStudyMode && comparativeStudyStage && (
            <StudyPhaseTransitionModal
              open={phaseTransitionModalOpen}
              stage={comparativeStudyStage}
              phaseLabel={upcomingComparativePhase?.label}
              phaseDescription={upcomingComparativePhase?.description}
              phaseIndex={upcomingComparativePhaseNumber}
              totalPhases={comparativeStudyPhases.length}
              surveyUrl={comparativeSurveyUrl}
              loading={phaseTransitionLoading}
              errorMessage={phaseTransitionError}
              onContinue={handlePhaseTransitionContinue}
            />
          )}
        </Box>
      </GetterContext.Provider>
    </ThemeProvider>
  );
};

const AppWrapper = () => (
  <AppStateProvider>
    <SetupConfigProvider>
      <ShortcutsProvider>
        <App />
      </ShortcutsProvider>
    </SetupConfigProvider>
  </AppStateProvider>
);

export default AppWrapper;
