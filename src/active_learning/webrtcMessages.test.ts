import { describe, expect, it } from 'vitest';
import { parseEpisodeStatus } from './webrtcMessages';

describe('WebRTC episode status', () => {
  it.each([[false, false], [true, false], [false, true], [true, true]])(
    'receives termination=%s and truncation=%s with the recorded step count',
    (terminated, truncated) => {
      const status = { type: 'episode_status', step_count: 5, done: terminated || truncated, terminated, truncated };
      expect(parseEpisodeStatus(JSON.stringify(status))).toEqual(status);
    },
  );

  it.each(['server_ready', 'pong test_connection', 'null', '{}', '{broken'])('ignores other channel messages: %s', message => {
    expect(parseEpisodeStatus(message)).toBeNull();
  });

  it('rejects inconsistent completion flags or invalid step counts', () => {
    const status = { type: 'episode_status', step_count: 3, done: true, terminated: true, truncated: false };
    expect(parseEpisodeStatus(JSON.stringify({ ...status, done: false }))).toBeNull();
    expect(parseEpisodeStatus(JSON.stringify({ ...status, step_count: -1 }))).toBeNull();
    expect(parseEpisodeStatus(JSON.stringify({ ...status, step_count: 0.5 }))).toBeNull();
  });
});
