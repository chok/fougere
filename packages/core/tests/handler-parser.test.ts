/**
 * The heritage clause, at the level of the parser that reads it.
 *
 * `crud-contract.test.ts` proves the ops reach the façade; this proves WHY, and pins the
 * one shape that broke it. `Crud` returns `asCrudConstructor(class CrudHandler { … })`,
 * so the class sits inside a call argument. A parser accepting only `return class { … }`
 * found nothing and said nothing — and because the scan cache keys on source rather than
 * on parser version, a warm cache kept serving the old, correct parse for weeks.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseAllHandlerMethods } from '../src/handler-parser.js';
import { setCacheRoot, getCached, setCached, flushCache, hashFile } from '../src/scan-cache.js';

/** A mixin file plus a handler extending it — the smallest thing the parser reads. */
function fixture(mixinBody: string): { dir: string; handler: string } {
  const dir = mkdtempSync(join(tmpdir(), 'fougere-parser-'));
  mkdirSync(join(dir, 'handlers'), { recursive: true });
  writeFileSync(join(dir, 'prefab.ts'), mixinBody);
  writeFileSync(
    join(dir, 'handlers', 'ThingHandler.ts'),
    `import { Prefab } from '../prefab.js';\nexport default class ThingHandler extends Prefab() {}\n`,
  );
  return { dir, handler: join(dir, 'handlers', 'ThingHandler.ts') };
}

const bare = `
export function Prefab() {
  return class PrefabBase {
    async list(): Promise<unknown[]> { return []; }
    async findById(id: string): Promise<unknown> { return id; }
  };
}
`;

const wrapped = `
function assertShape<T>(impl: object): T { return impl as T; }
export function Prefab() {
  return assertShape<unknown>(class PrefabBase {
    async list(): Promise<unknown[]> { return []; }
    async findById(id: string): Promise<unknown> { return id; }
  });
}
`;

const asserted = `
export function Prefab() {
  return (class PrefabBase {
    async list(): Promise<unknown[]> { return []; }
    async findById(id: string): Promise<unknown> { return id; }
  }) as unknown;
}
`;

describe('a handler inheriting from a mixin', () => {
  const opsOf = async (body: string) => {
    const { dir, handler } = fixture(body);
    try {
      // Heritage resolution is gated on a project root — without one the parser
      // reads the class alone and inherits nothing (workspace-only, by design).
      return (await parseAllHandlerMethods(handler, dir)).map((m) => m.name).sort();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('finds the ops when the mixin returns the class bare', async () => {
    expect(await opsOf(bare)).toEqual(['findById', 'list']);
  });

  // The regression: this is the shape `Crud` actually has.
  it('finds them when a helper call stands between `return` and the class', async () => {
    expect(await opsOf(wrapped)).toEqual(['findById', 'list']);
  });

  it('finds them behind parentheses and an `as` assertion', async () => {
    expect(await opsOf(asserted)).toEqual(['findById', 'list']);
  });
});

/**
 * The cache must not outlive the parser that filled it.
 *
 * This is the defect that hid the bug above: the hash answers "did the source change?",
 * never "does the parser still read it the same way?" — so a fix left every unchanged
 * handler serving the old parse, silently.
 */
describe('the scan cache carries the parser version', () => {
  it('ignores an envelope stamped by another parser, and rewrites it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fougere-cache-'));
    const target = join(dir, 'source.ts');
    writeFileSync(target, 'export default class X {}\n');

    try {
      setCacheRoot(dir);
      mkdirSync(join(dir, '.fougere'), { recursive: true });
      // A cache from a previous parser, claiming a result for this exact source.
      writeFileSync(
        join(dir, '.fougere', 'scan-cache.json'),
        JSON.stringify({ parser: 0, entries: { 'k': { hash: hashFile(target), data: 'stale' } } }),
      );

      expect(getCached('k', hashFile(target))).toBeNull();

      setCached('k', hashFile(target), 'fresh');
      flushCache();
      setCacheRoot(dir);
      expect(getCached('k', hashFile(target))).toBe('fresh');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
