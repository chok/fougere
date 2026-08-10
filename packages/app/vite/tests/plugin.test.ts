/**
 * The build policy, pinned.
 *
 * Every assertion here is a bug this file already had. The first version returned a
 * config patch and Vite's deep merge lost it behind the framework plugins, so three
 * production builds silently shipped a renamed entity. The second reserved nothing
 * because it looked for a class name that rollup had already erased.
 *
 * A build config is exactly the kind of code nobody tests and everybody trusts —
 * and it is the one that decides whether production designates the right entity.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fougere, entityNamesIn, RUNTIME_PACKAGES } from '../src/index.js';

/** A project tree shaped like a real one: fronds, each with its entities. */
function projectWith(fronds: Record<string, string[]>): string {
  const root = mkdtempSync(join(tmpdir(), 'fougere-vite-'));
  for (const [frond, entities] of Object.entries(fronds)) {
    const dir = join(root, 'fronds', frond, 'entities');
    mkdirSync(dir, { recursive: true });
    for (const entity of entities) writeFileSync(join(dir, entity), '');
  }
  return root;
}

/** Run the plugin's config hook the way Vite does, and hand back what it wrote. */
function resolve(plugin: ReturnType<typeof fougere>, config: Record<string, any> = {}) {
  const hook = plugin.config as { handler: (c: Record<string, any>) => void };
  hook.handler(config);
  return config;
}

describe('entityNamesIn', () => {
  it('reads every entity of every frond, by file name', () => {
    const root = projectWith({ blog: ['Post.ts', 'Author.ts'], user: ['User.ts'] });
    expect(entityNamesIn(root).sort()).toEqual(['Author', 'Post', 'User']);
  });

  it('accepts .tsx and ignores anything else', () => {
    const root = projectWith({ blog: ['Post.ts', 'Widget.tsx', 'notes.md', 'Post.js.map'] });
    expect(entityNamesIn(root).sort()).toEqual(['Post', 'Widget']);
  });

  it('answers nothing for a project with no fronds, rather than throwing', () => {
    expect(entityNamesIn(mkdtempSync(join(tmpdir(), 'empty-')))).toEqual([]);
  });

  it('skips a frond that declares no entities', () => {
    const root = projectWith({ blog: ['Post.ts'] });
    mkdirSync(join(root, 'fronds', 'empty'), { recursive: true });
    expect(entityNamesIn(root)).toEqual(['Post']);
  });
});

describe('the plugin runs last and writes, rather than proposing', () => {
  it('declares itself post so a framework plugin cannot overwrite it', () => {
    expect((fougere().config as { order: string }).order).toBe('post');
  });

  it('reserves the entity identifiers — the class name is already gone by then', () => {
    const root = projectWith({ blog: ['Post.ts', 'Author.ts'] });
    const config = resolve(fougere(), { root });

    expect(config.build.minify).toBe('terser');
    expect(config.build.terserOptions.mangle.reserved.sort()).toEqual(['Author', 'Post']);
  });

  it('overwrites a minifier the host already chose — that is the whole point', () => {
    const root = projectWith({ blog: ['Post.ts'] });
    const config = resolve(fougere(), { root, build: { minify: 'esbuild' } });
    expect(config.build.minify).toBe('terser');
  });

  it('keeps identifiers the app reserved itself', () => {
    const root = projectWith({ blog: ['Post.ts'] });
    const config = resolve(fougere(), {
      root,
      build: { terserOptions: { mangle: { reserved: ['MyThing'] } } },
    });
    expect(config.build.terserOptions.mangle.reserved.sort()).toEqual(['MyThing', 'Post']);
  });

  it('takes extra names from the caller, for entities outside fronds/', () => {
    const root = projectWith({ blog: ['Post.ts'] });
    const config = resolve(fougere({ reserved: ['Legacy'] }), { root });
    expect(config.build.terserOptions.mangle.reserved.sort()).toEqual(['Legacy', 'Post']);
  });

  it('touches no minifier when there is nothing to protect', () => {
    const config = resolve(fougere(), { root: mkdtempSync(join(tmpdir(), 'empty-')) });
    expect(config.build).toBeUndefined();
  });

  it('leaves the minifier alone when the app says so, and still externalizes', () => {
    const root = projectWith({ blog: ['Post.ts'] });
    const config = resolve(fougere({ keepClassNames: false }), { root });

    expect(config.build).toBeUndefined();
    expect(config.ssr.external).toContain('jiti');
  });
});

describe('the runtime packages', () => {
  it('keeps the boot out of the bundle — it reads frond sources off disk', () => {
    const config = resolve(fougere(), { root: mkdtempSync(join(tmpdir(), 'x-')) });
    for (const pkg of RUNTIME_PACKAGES) expect(config.ssr.external).toContain(pkg);
  });

  it('adds to what the app declared instead of replacing it', () => {
    const config = resolve(fougere({ external: ['sharp'] }), {
      root: mkdtempSync(join(tmpdir(), 'x-')),
      ssr: { external: ['mine'] },
    });
    expect(config.ssr.external).toContain('mine');
    expect(config.ssr.external).toContain('sharp');
    expect(config.ssr.external).toContain('jiti');
  });

  it('lists each package once', () => {
    const config = resolve(fougere({ external: ['jiti'] }), {
      root: mkdtempSync(join(tmpdir(), 'x-')),
      ssr: { external: ['jiti'] },
    });
    expect(config.ssr.external.filter((p: string) => p === 'jiti')).toHaveLength(1);
  });
});
