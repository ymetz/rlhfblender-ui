import ColormapDefault from './tri_corner_red_green_purple.png';

type Range = [number, number];
type Ranges = { x: Range; y: Range };
type Dimensions = { width: number; height: number };

type Color2DOptions = {
    dimensions?: Dimensions;
    ranges?: Ranges;
    colormap?: string;
};

const clamp = (value: number, min: number, max: number): number => {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
};

/**
 * Lightweight helper for sampling colors from a 2D colormap image.
 *
 * The class keeps an off-screen canvas and exposes synchronous lookup helpers
 * once the colormap image has been loaded.
 */
class Color2DMap {
    private canvas: HTMLCanvasElement | null = null;
    private context: CanvasRenderingContext2D | null = null;
    private imageData: Uint8ClampedArray | null = null;
    private readyPromise: Promise<void> | null = null;
    private ready = false;

    private _dimensions: Dimensions;
    private _ranges: Ranges;
    private colormapSrc: string | null;

    constructor(options?: Color2DOptions) {
        this._dimensions = options?.dimensions ?? { width: 512, height: 512 };
        this._ranges = options?.ranges ?? { x: [0, 1], y: [0, 1] };
        this.colormapSrc = options?.colormap ?? null;

        if (typeof document !== 'undefined' && this.colormapSrc) {
            void this.ensureReady();
        }
    }

    get ranges(): Ranges {
        return this._ranges;
    }

    set ranges(ranges: Ranges) {
        this._ranges = ranges;
    }

    get dimensions(): Dimensions {
        return this._dimensions;
    }

    set dimensions(dimensions: Dimensions) {
        this._dimensions = dimensions;
        if (this.canvas) {
            this.canvas.width = dimensions.width;
            this.canvas.height = dimensions.height;
        }
    }

    /**
     * Returns true once the colormap image has been drawn to the off-screen canvas.
     */
    isReady(): boolean {
        return this.ready && !!this.imageData;
    }

    /**
     * Ensures the colormap image is loaded. Safe to call multiple times.
     */
    ensureReady(): Promise<void> {
        if (this.isReady()) {
            return Promise.resolve();
        }

        if (typeof document === 'undefined') {
            // In SSR contexts we cannot create a canvas – treat as a no-op.
            this.readyPromise = Promise.resolve();
            return this.readyPromise;
        }

        if (!this.readyPromise) {
            this.readyPromise = this.loadColormap();
        }

        return this.readyPromise;
    }

    /**
     * Switches the underlying colormap image and reloads it.
     */
    setColormap(colormap: string): Promise<void> {
        this.colormapSrc = colormap;
        this.ready = false;
        this.imageData = null;
        this.readyPromise = null;
        return this.ensureReady();
    }

    private ensureCanvas(): void {
        if (this.canvas && this.context) {
            return;
        }

        if (typeof document === 'undefined') {
            throw new Error('Cannot create canvas without a document context.');
        }

        this.canvas = document.createElement('canvas');
        this.canvas.width = this._dimensions.width;
        this.canvas.height = this._dimensions.height;
        this.context = this.canvas.getContext('2d', { willReadFrequently: true });

        if (!this.context) {
            throw new Error('Failed to acquire 2D drawing context for the colormap canvas.');
        }
    }

    private loadColormap(): Promise<void> {
        if (!this.colormapSrc) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                this.ensureCanvas();
            } catch (error) {
                reject(error);
                return;
            }

            const image = new Image();
            image.crossOrigin = 'anonymous';

            image.onload = () => {
                const width = image.naturalWidth || image.width;
                const height = image.naturalHeight || image.height;

                this._dimensions = { width, height };

                if (this.canvas) {
                    this.canvas.width = width;
                    this.canvas.height = height;
                }

                this.context!.clearRect(0, 0, width, height);
                this.context!.drawImage(image, 0, 0, width, height);

                const data = this.context!.getImageData(0, 0, width, height).data;
                // Clone so we do not hold onto the live buffer of the canvas context.
                this.imageData = new Uint8ClampedArray(data);

                this.ready = true;
                resolve();
            };

            image.onerror = (event) => {
                console.error('Failed to load 2D colormap image', event);
                this.ready = false;
                reject(new Error('Failed to load 2D colormap image.'));
            };

            if (this.colormapSrc !== null) {
                image.src = this.colormapSrc;
            }
        });
    }

    private valueToPixel(value: number, [min, max]: Range, dimensionSize: number): number {
        if (max === min) {
            return Math.floor(dimensionSize / 2);
        }

        const ratio = (value - min) / (max - min);
        const clamped = clamp(ratio, 0, 1);
        return Math.round(clamped * (dimensionSize - 1));
    }

    private normalizedToPixel(value: number, dimensionSize: number): number {
        const clamped = clamp(value, 0, 1);
        return Math.round(clamped * (dimensionSize - 1));
    }

    private readColor(xPx: number, yPx: number): string | null {
        if (!this.imageData) {
            return null;
        }

        const { width, height } = this._dimensions;
        const clampedX = clamp(Math.round(xPx), 0, width - 1);
        const clampedY = clamp(Math.round(yPx), 0, height - 1);
        const baseIndex = (clampedY * width + clampedX) * 4;

        const r = this.imageData[baseIndex];
        const g = this.imageData[baseIndex + 1];
        const b = this.imageData[baseIndex + 2];

        return `rgb(${r}, ${g}, ${b})`;
    }

    /**
     * Samples the colormap using real-valued coordinates and the current ranges.
     */
    getColor(x: number, y: number): string | null {
        if (!this.isReady()) {
            return null;
        }

        const xPx = this.valueToPixel(x, this._ranges.x, this._dimensions.width);
        const yPx = this.valueToPixel(y, this._ranges.y, this._dimensions.height);
        return this.readColor(xPx, yPx);
    }

    /**
     * Samples the colormap using [0, 1] normalized coordinates, ignoring ranges.
     */
    getColorNormalized(x: number, y: number): string | null {
        if (!this.isReady()) {
            return null;
        }

        const xPx = this.normalizedToPixel(x, this._dimensions.width);
        const yPx = this.normalizedToPixel(y, this._dimensions.height);
        return this.readColor(xPx, yPx);
    }
}

const Color2D = new Color2DMap({ colormap: ColormapDefault });

export { Color2D, Color2DMap };
export type { Range, Ranges, Dimensions };
