import { describe, expect, it } from "vitest";
import { parseCheckpoint } from "./checkpoint";
import { appReducer, initialState } from "./AppStateContext";
import { limitEpisodesForCheckpoint } from "./trajectoryDisplayLimit";

describe("checkpoint selection", () => {
  it.each([null, undefined, "", " ", "not-a-checkpoint", NaN])(
    "keeps missing or invalid checkpoint %s separate from checkpoint zero",
    (value) => expect(parseCheckpoint(value)).toBeNull(),
  );

  it.each([-1, 0, 100])("accepts numeric and saved string checkpoint %s", (checkpoint) => {
    expect(parseCheckpoint(checkpoint)).toBe(checkpoint);
    expect(parseCheckpoint(String(checkpoint))).toBe(checkpoint);
  });

  it("requires a fresh checkpoint after switching experiments", () => {
    expect(initialState.selectedCheckpoint).toBeNull();
    const experiment = { ...initialState.selectedExperiment, id: 1, checkpoint_list: ["-1", "0"] };
    let state = appReducer(initialState, { type: "SET_SELECTED_EXPERIMENT", payload: experiment });
    expect(state.selectedCheckpoint).toBeNull();
    state = appReducer(state, { type: "SET_SELECTED_CHECKPOINT", payload: -1 });
    expect(state.selectedCheckpoint).toBe(-1);
    // Refreshing the same experiment, e.g. after training, preserves selection.
    state = appReducer(state, { type: "SET_SELECTED_EXPERIMENT", payload: experiment });
    expect(state.selectedCheckpoint).toBe(-1);
    state = appReducer({ ...state, sessionId: "previous-session" }, {
      type: "SET_SELECTED_EXPERIMENT", payload: { ...experiment, id: 2 },
    });
    expect(state.selectedCheckpoint).toBeNull();
    expect(state.sessionId).toBe("-");
  });

  it("clears the experiment and checkpoint when changing project", () => {
    const state = appReducer({
      ...initialState,
      selectedExperiment: { ...initialState.selectedExperiment, id: 1 },
      selectedCheckpoint: -1,
      sessionId: "previous-session",
      rankeableEpisodeIDs: ["old-episode"],
    }, { type: "SET_SELECTED_PROJECT", payload: { ...initialState.selectedProject, id: 2 } });
    expect(state.selectedExperiment.id).toBe(-1);
    expect(state.selectedCheckpoint).toBeNull();
    expect(state.sessionId).toBe("-");
    expect(state.rankeableEpisodeIDs).toEqual([]);
  });

  it("filters Random independently of trained checkpoints", () => {
    const episodes = [-1, 0, 100].map((checkpoint_step) => ({
      env_name: "dash-driving-v0", benchmark_id: 1, checkpoint_step, episode_num: 0, benchmark_type: "random",
    }));
    expect(limitEpisodesForCheckpoint(episodes, -1)).toEqual([episodes[0]]);
    expect(limitEpisodesForCheckpoint(episodes, 0)).toEqual([episodes[1]]);
  });
});
