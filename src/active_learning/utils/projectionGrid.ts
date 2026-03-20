export interface ProjectionBounds {
  x_min: number;
  x_max: number;
  y_min: number;
  y_max: number;
  grid_resolution?: number;
}

export interface ProjectionGridAxes {
  xValues: number[];
  yValues: number[];
  resolution: number;
}

export const DEFAULT_PROJECTION_GRID_RESOLUTION = 20;

const MIN_PROJECTION_GRID_RESOLUTION = 2;
const MAX_PROJECTION_GRID_RESOLUTION = 200;
const DEDUP_DECIMALS = 10;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const normalizeResolution = (
  requested?: number,
  fallback = DEFAULT_PROJECTION_GRID_RESOLUTION,
): number => {
  const base = isFiniteNumber(requested) ? Math.round(requested) : fallback;
  return Math.max(MIN_PROJECTION_GRID_RESOLUTION, Math.min(MAX_PROJECTION_GRID_RESOLUTION, base));
};

const createLinearAxis = (minValue: number, maxValue: number, resolution: number): number[] => {
  if (!isFiniteNumber(minValue) || !isFiniteNumber(maxValue)) {
    return [];
  }

  const normalizedResolution = normalizeResolution(resolution);
  if (normalizedResolution <= 1 || minValue === maxValue) {
    return [minValue];
  }

  const step = (maxValue - minValue) / (normalizedResolution - 1);
  return Array.from({ length: normalizedResolution }, (_, idx) => minValue + step * idx);
};

const uniqueSorted = (values: number[]): number[] => {
  const unique = new Map<string, number>();

  values.forEach((value) => {
    if (!isFiniteNumber(value)) return;
    const key = value.toFixed(DEDUP_DECIMALS);
    if (!unique.has(key)) {
      unique.set(key, value);
    }
  });

  return Array.from(unique.values()).sort((a, b) => a - b);
};

export const buildGridAxesFromBounds = (
  bounds?: ProjectionBounds,
  requestedResolution?: number,
): ProjectionGridAxes | null => {
  if (!bounds) return null;
  if (
    !isFiniteNumber(bounds.x_min)
    || !isFiniteNumber(bounds.x_max)
    || !isFiniteNumber(bounds.y_min)
    || !isFiniteNumber(bounds.y_max)
  ) {
    return null;
  }

  const resolution = normalizeResolution(
    requestedResolution ?? bounds.grid_resolution,
    DEFAULT_PROJECTION_GRID_RESOLUTION,
  );

  return {
    xValues: createLinearAxis(bounds.x_min, bounds.x_max, resolution),
    yValues: createLinearAxis(bounds.y_min, bounds.y_max, resolution),
    resolution,
  };
};

export const buildGridAxesFromCoordinates = (
  gridCoordinates: number[][],
  fallbackBounds?: ProjectionBounds,
  fallbackResolution = DEFAULT_PROJECTION_GRID_RESOLUTION,
): ProjectionGridAxes | null => {
  const hasCoordinates = Array.isArray(gridCoordinates) && gridCoordinates.length > 0;

  if (!hasCoordinates) {
    return buildGridAxesFromBounds(fallbackBounds, fallbackResolution);
  }

  const xValues = uniqueSorted(gridCoordinates.map((point) => point?.[0]).filter(isFiniteNumber));
  const yValues = uniqueSorted(gridCoordinates.map((point) => point?.[1]).filter(isFiniteNumber));

  if (xValues.length >= 2 && yValues.length >= 2) {
    return {
      xValues,
      yValues,
      resolution: Math.max(xValues.length, yValues.length),
    };
  }

  const finitePoints = gridCoordinates.filter(
    (point) => isFiniteNumber(point?.[0]) && isFiniteNumber(point?.[1]),
  );
  if (finitePoints.length === 0) {
    return buildGridAxesFromBounds(fallbackBounds, fallbackResolution);
  }

  const computedBounds: ProjectionBounds = fallbackBounds ?? {
    x_min: Math.min(...finitePoints.map((point) => point[0])),
    x_max: Math.max(...finitePoints.map((point) => point[0])),
    y_min: Math.min(...finitePoints.map((point) => point[1])),
    y_max: Math.max(...finitePoints.map((point) => point[1])),
  };

  const derivedResolution = Math.max(
    MIN_PROJECTION_GRID_RESOLUTION,
    Math.round(Math.sqrt(finitePoints.length)),
  );

  return buildGridAxesFromBounds(computedBounds, derivedResolution || fallbackResolution);
};
