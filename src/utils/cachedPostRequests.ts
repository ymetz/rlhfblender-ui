import axios, { AxiosRequestConfig, AxiosResponse } from "axios";

type CacheEntry = {
  expiresAt: number;
  response: AxiosResponse<unknown>;
};

const DEFAULT_TTL_MS = 15_000;
const responseCache = new Map<string, CacheEntry>();
const inFlightCache = new Map<string, Promise<AxiosResponse<unknown>>>();

const stableSerialize = (value: unknown): string => {
  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(",")}]`;
  }
  if (ArrayBuffer.isView(value)) {
    return `[${Array.from(
      new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
    ).join(",")}]`;
  }
  if (value instanceof ArrayBuffer) {
    return `[${Array.from(new Uint8Array(value)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entryValue]) => typeof entryValue !== "function")
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableSerialize(entryValue)}`)
      .join(",")}}`;
  }
  if (typeof value === "number" && Number.isNaN(value)) {
    return "NaN";
  }
  return JSON.stringify(value);
};

const buildCacheKey = (
  url: string,
  data: unknown,
  params: AxiosRequestConfig["params"],
): string => {
  return `${url}::${stableSerialize(params)}::${stableSerialize(data)}`;
};

export const clearCachedPostRequests = (): void => {
  responseCache.clear();
  inFlightCache.clear();
};

export const postCached = async <T = unknown>(
  url: string,
  data: unknown = null,
  config?: AxiosRequestConfig,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<AxiosResponse<T>> => {
  const key = buildCacheKey(url, data, config?.params);
  const now = Date.now();
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.response as AxiosResponse<T>;
  }
  if (cached) {
    responseCache.delete(key);
  }

  const pending = inFlightCache.get(key);
  if (pending) {
    return pending as Promise<AxiosResponse<T>>;
  }

  const requestPromise = axios
    .post<T>(url, data, config)
    .then((response) => {
      responseCache.set(key, {
        expiresAt: Date.now() + Math.max(0, ttlMs),
        response: response as AxiosResponse<unknown>,
      });
      return response;
    })
    .finally(() => {
      inFlightCache.delete(key);
    });

  inFlightCache.set(key, requestPromise as Promise<AxiosResponse<unknown>>);
  return requestPromise;
};
