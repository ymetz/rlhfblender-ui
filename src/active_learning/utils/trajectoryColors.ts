import { Color2D } from '../projection_utils/2dcolormaps';

/**
 * Shared utility functions for trajectory coloring across components
 */

const normalize = (value: number, min: number, max: number): number => {
    if (!Number.isFinite(value)) return 0.5;
    if (max === min) return 0.5;
    const ratio = (value - min) / (max - min);
    return Math.min(1, Math.max(0, ratio));
};

const extent = (values: number[]): [number, number] => {
    if (values.length === 0) return [0, 1];
    let min = values[0];
    let max = values[0];
    for (let i = 1; i < values.length; i += 1) {
        const value = values[i];
        if (!Number.isFinite(value)) {
            continue;
        }
        if (value < min) min = value;
        if (value > max) max = value;
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
        return [0, 1];
    }
    return [min, max];
};

/**
 * Similarity-based color assignment using final states
 * This function computes colors based on the final positions of trajectories,
 * assigning similar colors to trajectories that end in similar states.
 */
export function computeTrajectoryColors(episodeToPaths: Map<number, number[][]>): Map<number, string> {
    const trajectoryColors = new Map<number, string>();
    const finalStates = new Map<number, [number, number]>();

    // Extract final states for each trajectory
    episodeToPaths.forEach((pathPoints, episodeIdx) => {
        if (pathPoints.length > 0) {
            const finalState = pathPoints[pathPoints.length - 1];
            finalStates.set(episodeIdx, [finalState[0], finalState[1]]);
        }
    });

    const episodes = Array.from(finalStates.keys());
    const finalStateArray = episodes.map((ep) => finalStates.get(ep)).filter(Boolean) as [number, number][];

    if (finalStateArray.length === 0) {
        return trajectoryColors;
    }

    const xs = finalStateArray.map(([x]) => x);
    const ys = finalStateArray.map(([, y]) => y);
    const [xMin, xMax] = extent(xs);
    const [yMin, yMax] = extent(ys);

    const colorMapReady = Color2D.isReady();
    if (!colorMapReady) {
        void Color2D.ensureReady();
    }

    episodes.forEach((episodeIdx, i) => {
        const finalState = finalStateArray[i];
        if (!finalState) {
            return;
        }

        const [x, y] = finalState;
        const normalizedX = normalize(x, xMin, xMax);
        const normalizedY = normalize(y, yMin, yMax);

        const color = Color2D.getColorNormalized(normalizedX, normalizedY);
        trajectoryColors.set(episodeIdx, color ?? getFallbackColor(episodeIdx));
    });

    return trajectoryColors;
}

/**
 * Fallback color function for episodes without final states
 * Uses golden angle for good color distribution
 */
export function getFallbackColor(index: number): string {
    const hue = (index * 137.508) % 360; // Golden angle for good distribution
    return `hsl(${Math.round(hue)}, 70%, 50%)`;
}

/**
 * Get color for an episode, preferring similarity-based colors with fallback
 */
export function getEpisodeColor(
    episodeIdx: number,
    trajectoryColors: Map<number, string>,
    fallbackToIndex: boolean = true
): string {
    if (episodeIdx === -1) return '#888888';
    
    // Try similarity-based color first
    const similarityColor = trajectoryColors.get(episodeIdx);
    if (similarityColor) {
        return similarityColor;
    }
    
    // Fallback to golden angle distribution
    if (fallbackToIndex) {
        return getFallbackColor(episodeIdx);
    }
    
    return '#888888';
}
