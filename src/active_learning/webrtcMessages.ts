export interface EpisodeStatus {
  type: 'episode_status';
  step_count: number;
  done: boolean;
  terminated: boolean;
  truncated: boolean;
}

export function parseEpisodeStatus(message: string): EpisodeStatus | null {
  try {
    const value = JSON.parse(message);
    if (
      value?.type === 'episode_status' &&
      Number.isInteger(value.step_count) && value.step_count >= 0 &&
      typeof value.done === 'boolean' &&
      typeof value.terminated === 'boolean' &&
      typeof value.truncated === 'boolean' &&
      value.done === (value.terminated || value.truncated)
    ) {
      return value;
    }
  } catch {
    // The same channel also carries plain-text ping/pong and readiness messages.
  }
  return null;
}
