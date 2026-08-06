/**
 * Scan cache — caches parse results per file.
 *
 * Stores in .fougere/scan-cache.json.
 * Key: cache key (file path + suffix) → { hash, data }.
 * Hash: content hash of the source file.
 * If hash matches, skip parsing entirely → TypeScript never loaded.
 *
 * The envelope carries PARSER_VERSION, and a mismatch drops the whole file. The hash
 * answers "did this source change?"; it cannot answer "does the parser still read it the
 * same way?". A parser fix therefore left every unchanged handler serving the OLD parse,
 * indefinitely and without a word — that is how `Crud`'s inherited ops stayed silently
 * underived for weeks, until someone deleted `.fougere/` by hand and the tests went red.
 *
 * Bump PARSER_VERSION whenever the parser's OUTPUT for unchanged source can differ.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Bump when the parser can read unchanged source differently.
 *
 * 2 — `handler-parser` unwraps a class returned through a call/assertion, so a mixin
 *     like `asCrudConstructor(class { … })` yields its methods again.
 * 3 — parsed array types carry `arrayDepth`, used to distinguish a presenter page
 *     returning scalar fields from one returning list fields.
 */
const PARSER_VERSION = 3;

interface CacheEntry {
  hash: string;
  data: unknown;
}

interface CacheFile {
  parser: number;
  entries: Record<string, CacheEntry>;
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
      const file = JSON.parse(readFileSync(path, 'utf-8')) as Partial<CacheFile>;
      // A stamp from another parser is not stale data to refresh entry by entry — every
      // entry in the file was produced by it. Drop the lot; the next scan is cold once.
      if (file.parser === PARSER_VERSION && file.entries) {
        cache = file.entries;
        return cache;
      }
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
  const file: CacheFile = { parser: PARSER_VERSION, entries: cache };
  writeFileSync(path, JSON.stringify(file, null, 2));
  dirty = false;
}
