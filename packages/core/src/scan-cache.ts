/**
 * Scan cache — caches parse results per file.
 *
 * Stores in .fougere/scan-cache.json.
 * Key: cache key (file path + suffix) → { hash, data }.
 * Hash: content hash of the source file.
 * If hash matches, skip parsing entirely → TypeScript never loaded.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

interface CacheEntry {
  hash: string;
  data: unknown;
}

type CacheData = Record<string, CacheEntry>;

let root = process.cwd();
let cache: CacheData | null = null;
let dirty = false;

function cachePath(): string {
  return join(root, '.fougere', 'scan-cache.json');
}

export function setCacheRoot(dir: string): void {
  root = dir;
  cache = null;
}

function load(): CacheData {
  if (cache) return cache;
  const path = cachePath();
  if (existsSync(path)) {
    try {
      cache = JSON.parse(readFileSync(path, 'utf-8'));
      return cache!;
    } catch {
      // Corrupted cache — start fresh
    }
  }
  cache = {};
  return cache;
}

export function hashFile(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  return createHash('sha1').update(content).digest('hex').slice(0, 16);
}

/** Get cached parse result. Returns null if cache miss. */
export function getCached<T>(key: string, hash: string): T | null {
  const data = load();
  const entry = data[key];
  if (entry && entry.hash === hash) return entry.data as T;
  return null;
}

/** Store parse result in cache. */
export function setCached(key: string, hash: string, data: unknown): void {
  const store = load();
  store[key] = { hash, data };
  dirty = true;
}

// Legacy aliases — used by existing callers
export { getCached as getCachedMethods, setCached as setCachedMethods };

/** Write cache to disk if modified. */
export function flushCache(): void {
  if (!dirty || !cache) return;
  const path = cachePath();
  mkdirSync(join(root, '.fougere'), { recursive: true });
  writeFileSync(path, JSON.stringify(cache, null, 2));
  dirty = false;
}
