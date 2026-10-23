export function isDashDrivingEnvironment(environmentId: string): boolean {
  const normalized = (environmentId || '').trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized === 'dash-driving' ||
    normalized === 'dash-driving-v0' ||
    normalized.startsWith('dash-driving-') ||
    normalized.startsWith('dash_driving') ||
    normalized.includes('dash-driving')
  );
}

export function isBrowserMujocoEnvironment(environmentId: string): boolean {
  const normalized = (environmentId || '').trim().toLowerCase();
  return normalized === 'metaworld-sweep-into-v3';
}

export function getDemoSaveEndpoint(payload?: Record<string, any>): string {
  return payload?.browser_mujoco_demo
    ? '/demo_generation/save_browser_demo'
    : '/demo_generation/save_webrtc_demo';
}

export function isMiniGridEnvironment(environmentId: string): boolean {
  return /^(minigrid|babyai)-/i.test((environmentId || '').trim());
}

export const miniGridKeyActions: Readonly<Record<string, number>> = {
  arrowleft: 0, a: 0,
  arrowright: 1, d: 1,
  arrowup: 2, w: 2,
  pageup: 3, q: 3,
  pagedown: 4, e: 4,
  ' ': 5, space: 5,
  enter: 6,
};
