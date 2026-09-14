"use client";

type CacheEntry<T> = {
  value?: T;
  promise?: Promise<T>;
  expiresAt: number;
};

const TTL_MS = 60_000;
const cache = new Map<string, CacheEntry<unknown>>();

/** Deduplicate concurrent public API fetches across header/nav/widgets. */
export function fetchPublicJson<T>(path: string, ttlMs = TTL_MS): Promise<T> {
  const now = Date.now();
  const existing = cache.get(path) as CacheEntry<T> | undefined;
  if (existing?.value !== undefined && existing.expiresAt > now) {
    return Promise.resolve(existing.value);
  }
  if (existing?.promise) return existing.promise;

  const promise = fetch(path)
    .then(async (res) => {
      const payload = await res.json();
      const value = payload as T;
      cache.set(path, { value, expiresAt: now + ttlMs });
      return value;
    })
    .catch((error) => {
      cache.delete(path);
      throw error;
    });

  cache.set(path, { promise, expiresAt: now + ttlMs });
  return promise;
}
