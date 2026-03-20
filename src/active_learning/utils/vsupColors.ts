import * as d3 from 'd3';

// Slightly brighten the low-uncertainty end of VSUP colors so neutral areas stay closer to white.
export const VSUP_BASE_BRIGHTENING = 0.12;

export const interpolateBrightCividis = (value: number): string => {
    const clamped = Math.min(1, Math.max(0, value));
    const baseColor = d3.interpolateCividis(clamped);
    return d3.interpolateLab(baseColor, '#ffffff')(VSUP_BASE_BRIGHTENING);
};
