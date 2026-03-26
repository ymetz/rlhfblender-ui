import { Episode } from "./types";

export const ENABLE_SCREENSHOT_TRAJECTORY_LIMIT = false;
export const SCREENSHOT_MAX_TRAJECTORIES_PER_CHECKPOINT = 5;

const normalizeLimit = (value: number): number => {
  if (!Number.isFinite(value)) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(1, Math.floor(value));
};

export const getTrajectoryDisplayLimit = (
  defaultLimit: number = Number.POSITIVE_INFINITY,
): number => {
  if (!ENABLE_SCREENSHOT_TRAJECTORY_LIMIT) {
    return normalizeLimit(defaultLimit);
  }
  return normalizeLimit(SCREENSHOT_MAX_TRAJECTORIES_PER_CHECKPOINT);
};

export const limitEpisodesForCheckpoint = (
  episodes: Episode[],
  checkpointStep: number,
  defaultLimit: number = Number.POSITIVE_INFINITY,
): Episode[] => {
  const checkpointEpisodes = (episodes || []).filter(
    (episode) => Number(episode.checkpoint_step) === checkpointStep,
  );

  const limit = getTrajectoryDisplayLimit(defaultLimit);
  if (!Number.isFinite(limit)) {
    return checkpointEpisodes;
  }
  return checkpointEpisodes.slice(0, limit);
};

export const buildEpisodeKeepMask = (
  episodeIndices: number[],
  defaultLimit: number = Number.POSITIVE_INFINITY,
): boolean[] => {
  const limit = getTrajectoryDisplayLimit(defaultLimit);
  if (!Number.isFinite(limit)) {
    return episodeIndices.map(() => true);
  }

  const allowedEpisodes = new Set<number>();
  return episodeIndices.map((episodeIndex) => {
    if (allowedEpisodes.has(episodeIndex)) {
      return true;
    }
    if (allowedEpisodes.size >= limit) {
      return false;
    }
    allowedEpisodes.add(episodeIndex);
    return true;
  });
};
