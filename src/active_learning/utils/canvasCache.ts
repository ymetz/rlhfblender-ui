export interface CanvasCacheEntry {
    image: HTMLImageElement;
    bounds: any;
}

export const canvasImageCache = new Map<string, CanvasCacheEntry>();

export const clearCanvasImageCache = () => {
    canvasImageCache.clear();
};
