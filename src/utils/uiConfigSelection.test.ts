import { describe, expect, it } from "vitest";
import { defaultBackendConfig, defaultUIConfig } from "../default-setup-configs";
import { standaloneUIConfigKey } from "./uiConfigSelection";
import { isMiniGridEnvironment, isBrowserMujocoEnvironment, isDashDrivingEnvironment, miniGridKeyActions } from "../active_learning/demoEnvironment";

describe("standalone config selection", () => {
  it("invalidates sampling after a menu selection or an edit", () => {
    const original = standaloneUIConfigKey(defaultBackendConfig, defaultUIConfig);
    expect(standaloneUIConfigKey(defaultBackendConfig, { ...defaultUIConfig, id: "babyai" })).not.toBe(original);
    expect(standaloneUIConfigKey(defaultBackendConfig, { ...defaultUIConfig, max_ranking_elements: 1 })).not.toBe(original);
  });

  it("does not reset a backend sequence when it advances to another config", () => {
    const backend = { ...defaultBackendConfig, selectedUiConfigs: [{ id: "first", name: "First" }, { id: "second", name: "Second" }] };
    expect(standaloneUIConfigKey(backend, { ...defaultUIConfig, id: "first" }))
      .toBe(standaloneUIConfigKey(backend, { ...defaultUIConfig, id: "second" }));
  });
});

describe("grid demo controls", () => {
  it.each(["MiniGrid-Empty-5x5-v0", "BabyAI-MiniBossLevel-v0"])("uses discrete controls for %s", (id) => {
    expect(isMiniGridEnvironment(id)).toBe(true);
    expect(isBrowserMujocoEnvironment(id)).toBe(false);
    expect(isDashDrivingEnvironment(id)).toBe(false);
  });
  it("keeps the browser simulators on their own paths", () => {
    expect(isBrowserMujocoEnvironment("metaworld-sweep-into-v3")).toBe(true);
    expect(isDashDrivingEnvironment("dash-driving-v0")).toBe(true);
    expect(isMiniGridEnvironment("dash-driving-v0")).toBe(false);
  });
  it("maps arrows and object controls to MiniGrid's action enumeration", () => {
    expect(["arrowleft", "arrowright", "arrowup", "q", "e", " ", "enter"].map(key => miniGridKeyActions[key]))
      .toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});
