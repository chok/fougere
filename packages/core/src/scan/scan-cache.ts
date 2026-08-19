/**
 * A parse kept per file, so an unchanged source never loads TypeScript again.
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
// 4 — the parse became a pair (methods + unresolvedHeritage); a v3 entry
//     would answer with an array and lose the half that reports what it could not open.
// 5 — a method carried `readOnly`, read off its body. REMOVED (2026-08-16): it answered
//     "does this touch storage", not "is this a read", so a read that wrote an audit row
//     was published as a mutation. The number stays taken; going back to 4 would revive
//     a v4 cache written before 5, which is the same shape but not the same history.
const PARSER_VERSION = 6;

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

function hashFile(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  return createHash('sha1').update(content).digest('hex').slice(0, 16);
}

/**
 * The parse of a file, or the parse again if the file changed — the one gesture, so a
 * caller never assembles the pieces.
 *
 * It handed out `hashFile` + `getCached` + `setCached` and every caller wrote the same
 * five lines in the same order; the scanner wrote them three times, once inline inside a
 * `try`. Three assemblies of one question, each free to forget the half that stores.
 *
 * `key` and not the path alone: one file is parsed several ways (its constructor, its
 * methods, its methods with heritage resolved) and each reading is its own entry.
 */
export async function cachedParse<T>(key: string, filePath: string, parse: () => Promise<T>): Promise<T> {
  const hash = hashFile(filePath);
  const store = load();
  const entry = store[key];
  if (entry && entry.hash === hash) return entry.data as T;

  const data = await parse();
  store[key] = { hash, data };
  dirty = true;
  return data;
}

/** Write cache to disk if modified. */
export function flushCache(): void {
  if (!dirty || !cache) return;
  const path = cachePath();
  mkdirSync(join(root, '.fougere'), { recursive: true });
  const file: CacheFile = { parser: PARSER_VERSION, entries: cache };
  writeFileSync(path, JSON.stringify(file, null, 2));
  dirty = false;
}
