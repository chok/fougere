import { describe, it, expect } from 'vitest';
import { generateBootPlugin, extensionsOf } from '../src/module.js';
import type { FougereConfig } from '@fougere/core';

/**
 * The two `db:` shorthand forms must resolve to the SAME default path.
 * Regression for the split-brain bug: `db: 'sqlite'` used to embed a hardcoded
 * `path: ':memory:'` in the generated plugin, while the runtime fallback
 * (fougereApp.ts) and every other consumer of resolveStorage() default to a
 * file (`fougere.db`, via schema-sql's setupSqlite). The fix is to stop
 * re-deriving a path here at all: pass `db` straight through to
 * resolveStorage(), the single place that owns the default.
 */
describe('generateBootPlugin — db path convergence', () => {
  it('db: "sqlite" (string form) passes the config through unchanged — no path override', () => {
    const out = generateBootPlugin({ db: 'sqlite' } as FougereConfig, [], '@fougere/nuxt/fougereApp');

    expect(out).toContain('resolveStorage("sqlite")');
    // The old bug: this literal must never reappear for the string form.
    expect(out).not.toContain(':memory:');
    expect(out).not.toContain("path: '");
  });

  it('db: { dialect, path } (object form) still carries its explicit path through', () => {
    const out = generateBootPlugin(
      { db: { dialect: 'sqlite', path: '.data/site.db' } } as FougereConfig,
      [],
      '@fougere/nuxt/fougereApp',
    );

    expect(out).toContain('resolveStorage({"dialect":"sqlite","path":".data/site.db"})');
    expect(out).not.toContain(':memory:');
  });

  it('db: { dialect } with no path also defers to resolveStorage — no local default', () => {
    const out = generateBootPlugin(
      { db: { dialect: 'sqlite' } } as FougereConfig,
      [],
      '@fougere/nuxt/fougereApp',
    );

    expect(out).toContain('resolveStorage({"dialect":"sqlite"})');
    expect(out).not.toContain(':memory:');
  });

  it('carries `sources:` through — where a row lives is not the host\u2019s business either', () => {
    const out = generateBootPlugin(
      {
        db: 'sqlite',
        sources: { archive: { path: '.data/archive.db', entities: ['Book'] } },
      } as FougereConfig,
      [],
      '@fougere/nuxt/fougereApp',
    );

    // Same reason `db` passes through untouched: this host must not know which package
    // backs a source, only that the declaration reaches the one place that resolves it.
    expect(out).toContain('resolveStorage("sqlite", {"archive":{"path":".data/archive.db","entities":["Book"]}})');
  });

  /**
   * The plugin used to CLAIM the whole post-boot (`afterBoot`) to get its static-import
   * seeding, and its copy of the loop drifted — losing the storage fallback, in the one
   * copy that runs when you open the app. It now names the member it replaces.
   */
  it('declares two members of the ascent, and names the one it replaces', () => {
    const out = generateBootPlugin(
      { db: 'sqlite' } as FougereConfig,
      [{ entityName: 'post', data: [], filePath: '/app/fronds/blog/seeds/post.ts' }] as never,
      '@fougere/nuxt/fougereApp',
    );

    expect(out).toContain('extensions: [');
    // The storage's ascent is core's own declaration, so this codegen states no name.
    expect(out).toContain('migrating(storage.migrate)');
    // And the seeding says which member it is, instead of taking over everything.
    expect(out).toContain("{ name: 'seeds', up: (app) => runSeeds(app, [");
    expect(out).not.toContain('afterBoot');
  });

  it('db: false skips storage entirely', () => {
    const out = generateBootPlugin({ db: false } as FougereConfig, [], '@fougere/nuxt/fougereApp');
    expect(out).not.toContain('resolveStorage');
  });
});

describe('a storage that could not be opened', () => {
  it('states the scan before it tries, so a failure costs the storage alone', () => {
    // Measured on workerd: `resolveStorage` threw on a native driver, Nitro swallowed the
    // plugin whole, and the app came up with ZERO fronds and not a word. Two unrelated
    // facts were sharing one failure.
    const out = generateBootPlugin({ db: 'sqlite' }, [], '/app/boot', '/nuxt/scan.mjs');

    // Both positions asserted present first: `indexOf` answers -1 for an absent needle,
    // and -1 is less than anything — this very assertion passed for that reason once.
    const stated = out.indexOf('configureFougere({ scan,');
    const opened = out.indexOf('resolveStorage("sqlite")');
    expect(stated).toBeGreaterThan(-1);
    expect(opened).toBeGreaterThan(-1);
    expect(stated).toBeLessThan(opened);
  });

  it('reports it rather than dying quietly', () => {
    const out = generateBootPlugin({ db: 'sqlite' }, [], '/app/boot', '/nuxt/scan.mjs');

    expect(out).toContain('try {');
    expect(out).toContain('storage could not be opened');
  });

  it('states the scan even when no storage is declared', () => {
    // The early return used to emit an empty plugin, which threw the scan away with the
    // storage — and an app with no database still has fronds.
    const out = generateBootPlugin({ db: false }, [], '/app/boot', '/nuxt/scan.mjs');

    expect(out).toContain('configureFougere({ scan,');
    expect(out).not.toContain('resolveStorage');
  });

  it('carries the topology, because a consumer has nothing else', () => {
    // `remotes:` is the whole reason an app that hosts nothing boots at all, and `boot()`
    // used to re-read it off a disk the Worker does not have. `auth` is deliberately not
    // carried: it holds a live provider, not a value.
    const out = generateBootPlugin(
      { db: false, remotes: { catalog: 'https://x.workers.dev' }, auth: (() => {}) as never },
      [], '/app/boot', '/nuxt/scan.mjs',
    );

    expect(out).toContain('"remotes":{"catalog":"https://x.workers.dev"}');
    expect(out).not.toContain('auth');
  });
});

describe('generateBootPlugin — extensions named in the fougere: section', () => {
  it('changes nothing when the section names none', () => {
    const before = generateBootPlugin({ db: 'sqlite' } as FougereConfig, [], '@fougere/nuxt/fougereApp');
    const after = generateBootPlugin({ db: 'sqlite' } as FougereConfig, [], '@fougere/nuxt/fougereApp', undefined, []);

    expect(after).toBe(before);
  });

  it('writes one import and one member per key, the key being both', () => {
    const out = generateBootPlugin(
      { db: 'sqlite' } as FougereConfig, [], '@fougere/nuxt/fougereApp', undefined,
      [{ key: 'observability', options: { service: 'blog' } }, { key: 'calls', options: { panel: 4400 } }],
    );

    expect(out).toContain("import { observability } from '@fougere/observability';");
    expect(out).toContain("import { calls } from '@fougere/calls';");
    expect(out).toContain('observability({"service":"blog"}),');
    expect(out).toContain('calls({"panel":4400}),');
  });

  it('mounts them after the framework members, never before', () => {
    const out = generateBootPlugin(
      { db: 'sqlite' } as FougereConfig, [], '@fougere/nuxt/fougereApp', undefined,
      [{ key: 'calls', options: {} }],
    );

    // Tables, then rows, then what the host adds — the order `boot.ts` already states.
    expect(out.indexOf('migrating(')).toBeLessThan(out.indexOf('calls({}'));
  });
});

describe('extensionsOf', () => {
  it('keeps mount order regardless of the order the project wrote', () => {
    // `observability` opens the span every log line inside a call carries, so it goes first
    // whatever nuxt.config says.
    expect(extensionsOf({ calls: {}, observability: {} }).map((one) => one.key))
      .toEqual(['observability', 'calls']);
  });

  it('reads `false` as off, and an absent key as unasked', () => {
    expect(extensionsOf({ calls: false, observability: { service: 'x' } })).toEqual([
      { key: 'observability', options: { service: 'x' } },
    ]);
    expect(extensionsOf({})).toEqual([]);
  });
});
