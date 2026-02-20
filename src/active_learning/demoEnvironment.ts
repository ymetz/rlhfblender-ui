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

