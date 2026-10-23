import { BackendConfig, UIConfig } from "../types";

// An explicit backend sequence owns the active config as it advances. Without
// a sequence, edits/selections in the UI config menu must invalidate sampling.
export const standaloneUIConfigKey = (
  backendConfig: BackendConfig,
  uiConfig: UIConfig,
): string =>
  backendConfig.selectedUiConfigs.length === 0 ? JSON.stringify(uiConfig) : "sequence";
