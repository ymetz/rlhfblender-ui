/** null means unselected; -1 is the valid random-policy checkpoint. */
export const parseCheckpoint = (
  value: number | string | null | undefined,
): number | null => {
  if (value == null || (typeof value === "string" && value.trim() === "")) {
    return null;
  }
  const checkpoint = Number(value);
  return Number.isFinite(checkpoint) ? checkpoint : null;
};
