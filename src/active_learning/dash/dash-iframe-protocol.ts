export const DASH_PROTOCOL_VERSION = "1.0" as const;

export type DashSource = "dash-host" | "dash-player";

export type DashEnvelope<TPayload = unknown> = {
  source: DashSource;
  version: typeof DASH_PROTOCOL_VERSION;
  id?: string;
  type: string;
  payload?: TPayload;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type DashSeekPayload = {
  mode: "time" | "frame";
  value: number;
};

export type DashInitPayload = {
  scenarioCode?: string;
  scenarioJson?: Record<string, unknown>;
  recording?: Record<string, unknown>;
  startMode?: "manual" | "autonomous";
  paused?: boolean;
  seek?: DashSeekPayload;
};

export type DashStatePayload = {
  simTime: number;
  paused: boolean;
  mode: "manual" | "autonomous";
  car: { x: number; y: number; rot: number; speed: number };
  station?: number;
  latitude?: number;
};

export type DashHostToPlayer =
  | DashEnvelope<DashInitPayload> & { type: "dash.init" }
  | DashEnvelope<DashInitPayload> & { type: "dash.loadScenario" }
  | DashEnvelope<{ recording: Record<string, unknown> } | Record<string, unknown>> & { type: "dash.loadRecording" }
  | DashEnvelope<DashSeekPayload> & { type: "dash.seek" }
  | DashEnvelope<{ mode: "manual" | "autonomous" }> & { type: "dash.setMode" }
  | DashEnvelope<{ forward?: boolean; backward?: boolean; left?: boolean; right?: boolean; brake?: boolean }> & {
      type: "dash.setKeys";
    }
  | DashEnvelope<undefined> & { type: "dash.clearKeys" }
  | DashEnvelope<undefined> & { type: "dash.play" | "dash.pause" | "dash.reset" | "dash.getState" };

export type DashPlayerToHost =
  | DashEnvelope<{ capabilities: string[] }> & { type: "dash.ready" }
  | DashEnvelope<{ command: string; ok: true; data?: unknown }> & { type: "dash.ack" }
  | DashEnvelope<{ command: string; ok: false }> & { type: "dash.nack" }
  | DashEnvelope<DashStatePayload> & { type: "dash.state" };

export function makeDashHostMessage<TPayload>(
  type: DashHostToPlayer["type"],
  payload?: TPayload,
  id?: string,
): DashEnvelope<TPayload> {
  return {
    source: "dash-host",
    version: DASH_PROTOCOL_VERSION,
    type,
    id,
    payload,
  };
}

