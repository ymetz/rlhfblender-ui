/**
 * Shared utility functions for trajectory coloring across components
 */

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
    
    // Compute similarity matrix and assign colors
    const episodes = Array.from(finalStates.keys());
    const finalStateArray = episodes.map(ep => finalStates.get(ep)).filter(Boolean) as [number, number][];
    
    if (finalStateArray.length === 0) return trajectoryColors;
    
    // Use 2D color mapping based on final state position
    episodes.forEach((episodeIdx, i) => {
        const finalState = finalStateArray[i];
        if (finalState) {
            // Use hue based on angle from center, saturation based on distance
            const centerX = finalStateArray.reduce((sum, state) => sum + state[0], 0) / finalStateArray.length;
            const centerY = finalStateArray.reduce((sum, state) => sum + state[1], 0) / finalStateArray.length;
            
            const dx = finalState[0] - centerX;
            const dy = finalState[1] - centerY;
            const angle = Math.atan2(dy, dx);
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // Convert to hue (0-360)
            const hue = ((angle + Math.PI) / (2 * Math.PI)) * 360;
            
            // Normalize distance for saturation (0-100)
            const maxDistance = Math.max(...finalStateArray.map(state => {
                const dx2 = state[0] - centerX;
                const dy2 = state[1] - centerY;
                return Math.sqrt(dx2 * dx2 + dy2 * dy2);
            }));
            const saturation = maxDistance > 0 ? Math.min(100, (distance / maxDistance) * 80 + 20) : 50;
            
            trajectoryColors.set(episodeIdx, `hsl(${Math.round(hue)}, ${Math.round(saturation)}%, 50%)`);
        }
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