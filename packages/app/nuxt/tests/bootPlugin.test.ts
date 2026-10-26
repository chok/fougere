import { describe, it, expect } from 'vitest';
import { generateBootPlugin, extensionsOf } from '../src/module.js';
import type { FougereConfig } from '@fougere/core';

/**
 * `sources:` passes straight through to resolveStorage(), the single place that reads it — this
 * host never re-derives a path, a type or a default.
 */
describe('generateBootPlugin — sources pass through', () => {
  it('no sources: names no engine — the host resolves memory, the same as every other host', () => {
    const out = generateBootPlugin({} as FougereConfig, [], '@fougere/nuxt/fougereApp');

    expect(out).not.toContain('resolveStorage');
    expect(out).not.toContain('sqlite');
  });

  it('carries each entry through unchanged — no path override', () => {
    const out = generateBootPlugin(
      { sources: { main: { type: 'sqlite', path: '.data/site.db' } } } as unknown as FougereConfig,
      [],
      '@fougere/nuxt/fougereApp',
    );

    expect(out).toContain('resolveStorage({"main":{"type":"sqlite","path":".data/site.db"}})');
    expect(out).not.toContain(':memory:');
  });

  it('écrit la racine en littéral — le plugin tourne avec le répertoire de Nitro', () => {
    // Sans elle, `apps/nuxt` a fabriqué une SECONDE base vide à côté de lui pendant que
    // le workspace tenait la vraie, et l'app a servi un domaine vide avec un boot vert.
    const out = generateBootPlugin(
      { sources: { main: { type: 'sqlite', path: '.data/site.db' } } } as unknown as FougereConfig,
      [],
      '@fougere/nuxt/fougereApp',
      [],
      undefined,
      '/w',
    );

    expect(out).toContain('resolveStorage({"main":{"type":"sqlite","path":".data/site.db"}}, "/w")');
  });

  it('counts from the directory the server starts in, for a build', () => {
    // A build runs elsewhere: in an image `/repo/site` does not exist, and the boot refused on
    // `EACCES: mkdir '/repo/site/.data'` while the volume sat at `/app/.data`.
    const out = generateBootPlugin(
      { sources: { main: { type: 'sqlite', path: '.data/site.db' } } } as unknown as FougereConfig,
      [],
      '@fougere/nuxt/fougereApp',
      [],
      undefined,
      '/w',
      undefined,
      null,
    );

    expect(out).toContain('resolveStorage({"main":{"type":"sqlite","path":".data/site.db"}});');
  });

  it('carries a second source through — where a row lives is not the host\u2019s business either', () => {
    const out = generateBootPlugin(
      {
        sources: { main: {}, archive: { type: 'sqlite', path: '.data/archive.db', rows: ['Book'] } },
      } as unknown as FougereConfig,
      [],
      '@fougere/nuxt/fougereApp',
    );

    expect(out).toContain('resolveStorage({"main":{},"archive":{"type":"sqlite","path":".data/archive.db","rows":["Book"]}})');
  });

  /**
   * The plugin used to CLAIM the whole post-boot (`afterBoot`) to get its static-import
   * seeding, and its copy of the loop drifted — losing the storage fallback, in the one
   * copy that runs when you open the app. It now names the member it replaces.
   */
  it('hands the storage over whole, writes no schema, and names the member it replaces', () => {
    const out = generateBootPlugin(
      { sources: { main: {} } } as unknown as FougereConfig,
      [{ entityName: 'post', data: [], filePath: '/app/fronds/blog/seeds/post.ts' }] as never,
      '@fougere/nuxt/fougereApp',
    );

    expect(out).toContain('extensions: [');
    // The storage travels whole and the boot only READS the schema: nothing here migrates,
    // since writing it is `fougere migrate --apply`.
    expect(out).toContain('      storage,');
    expect(out).not.toContain('migrate');
    // And the seeding says which member it is, instead of taking over everything.
    expect(out).toContain("{ name: 'seeds', up: (app) => runSeeds(app, [");
    expect(out).not.toContain('afterBoot');
  });

});

describe('a storage that could not be opened', () => {
  it('states what it hosts before it tries, so a failure costs the storage alone', () => {
    // Measured on workerd: `resolveStorage` threw on a native driver, Nitro swallowed the
    // plugin whole, and the app came up with ZERO fronds and not a word. Two unrelated
    // facts were sharing one failure.
    const out = generateBootPlugin({ sources: { main: {} } } as never, [], '/app/boot', [], '/app/fronds.ts');

    // Both positions asserted present first: `indexOf` answers -1 for an absent needle,
    // and -1 is less than anything — this very assertion passed for that reason once.
    const stated = out.indexOf('configureFougere({');
    const opened = out.indexOf('resolveStorage({"main":{}})');
    expect(stated).toBeGreaterThan(-1);
    expect(opened).toBeGreaterThan(-1);
    expect(stated).toBeLessThan(opened);
  });

  it('reports it rather than dying quietly', () => {
    const out = generateBootPlugin({ sources: { main: {} } } as never, [], '/app/boot', [], '/app/fronds.ts');

    expect(out).toContain('try {');
    expect(out).toContain('storage could not be opened');
  });

  it('states what it hosts even when no storage is declared', () => {
    // The early return used to emit an empty plugin, which threw the scan away with the
    // storage — and an app with no database still has fronds.
    const out = generateBootPlugin({}, [], '/app/boot', [], '/app/fronds.ts');

    expect(out).toContain('configureFougere({ fronds,');
    expect(out).not.toContain('resolveStorage');
  });

  it('carries the topology, because a consumer has nothing else', () => {
    // `fronds:` is the whole reason an app that hosts nothing boots at all, and `boot()`
    // used to re-read it off a disk the Worker does not have.
    const out = generateBootPlugin(
      { fronds: { catalog: 'https://x.workers.dev' } },
      [], '/app/boot', [], '/app/fronds.ts',
    );

    expect(out).toContain('"fronds":{"catalog":"https://x.workers.dev"}');
  });

  it('carries `ports:`, or two realizations refuse the boot with the line that settles it written', () => {
    const out = generateBootPlugin(
      { ports: { Payment: 'FakePayment' } },
      [], '/app/boot', [], '/app/fronds.ts',
    );

    expect(out).toContain('"ports":{"Payment":"FakePayment"}');
  });
});

describe('generateBootPlugin — extensions named in the fougere: section', () => {
  it('changes nothing when the section names none', () => {
    const before = generateBootPlugin({ sources: { main: {} } } as unknown as FougereConfig, [], '@fougere/nuxt/fougereApp');
    const after = generateBootPlugin({ sources: { main: {} } } as unknown as FougereConfig, [], '@fougere/nuxt/fougereApp', []);

    expect(after).toBe(before);
  });

  it('writes one import and one member per key, the key being both', () => {
    const out = generateBootPlugin(
      { sources: { main: {} } } as unknown as FougereConfig, [], '@fougere/nuxt/fougereApp',
      [{ key: 'observability', options: { service: 'blog' } }, { key: 'calls', options: { panel: 4400 } }],
    );

    expect(out).toContain("import { observability } from '@fougere/observability';");
    expect(out).toContain("import { calls } from '@fougere/calls';");
    expect(out).toContain('observability({"service":"blog"}),');
    expect(out).toContain('calls({"panel":4400}),');
  });

  it('states no order of its own — tables before rows belongs to core', () => {
    const out = generateBootPlugin(
      { sources: { main: {} } } as unknown as FougereConfig, [], '@fougere/nuxt/fougereApp',
      [{ key: 'calls', options: {} }],
    );

    // It hands the gesture over and lists what the host adds. Where those two sit relative
    // to each other is `createApp`'s, and pinned by `core/tests/lifecycle.test.ts`.
    expect(out.indexOf('migrate: storage.migrate,')).toBeLessThan(out.indexOf('extensions: ['));
    expect(out).toContain('calls({}),');
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

  /**
   * A `fronds.ts` beside `fougere.config.ts` is the app stating what it hosts.
   *
   * The generated plugin imports the AUTHOR's file. No module of classes is emitted: one
   * used to be, and it re-stated what the classes already carry — signatures the checker
   * owns, operations `Crud` declares at runtime — while being imported by a path a bundler
   * treats as external, which broke `nuxt dev` in-process. It is the same facade
   * `configureFougere({ fronds })` opens for every host that is not Nuxt.
   */
  describe('when the app states its fronds', () => {
    it('imports the stated file and passes `fronds`', () => {
      const out = generateBootPlugin(
        { sources: { main: {} } } as unknown as FougereConfig, [], '/app/boot', [], '/app/fronds.ts');

      expect(out).toContain("import fronds, * as statement from '/app/fronds';");
      expect(out).toContain('configureFougere({');
      expect(out).toContain('fronds,');
      expect(out).toContain('vocabulary: statement.vocabulary,');
    });

    it('drops the extension a bundler would refuse to resolve', () => {
      const out = generateBootPlugin(
        { sources: { main: {} } } as unknown as FougereConfig, [], '/app/boot', [], '/app/fronds.mts');

      expect(out).toContain("import fronds, * as statement from '/app/fronds';");
    });

    it('configures even when the app states nothing, so the absence is answered', () => {
      // `hostedBy` names both keys and refuses. Skipping the call boots a silent app whose
      // every facade answers NOT_FOUND with nothing said.
      const out = generateBootPlugin({ sources: { main: {} } } as unknown as FougereConfig, [], '/app/boot');

      expect(out).toContain('configureFougere({');
      expect(out).not.toContain('import fronds');
    });
  });
  describe('a module key', () => {
    it('is handed over as the config file wrote it, since its options may hold a class', () => {
      const out = generateBootPlugin(
        { sources: { main: {} } } as unknown as FougereConfig, [], '/app/boot', [], undefined, undefined,
        '/app/fougere.config.ts');

      expect(out).toContain("import config from '/app/fougere.config';");
      expect(out).toContain('fronds: config.fronds }');
    });

    it('is handed over even when the app declares no storage', () => {
      const out = generateBootPlugin(
        {} as FougereConfig, [], '/app/boot', [], undefined, undefined, '/app/fougere.config.ts');

      expect(out).toContain('fronds: config.fronds }');
    });
  });
});

describe('generateBootPlugin — a module key', () => {
  it('is imported by the bundle and handed to the loader, since nothing resolves it at runtime', () => {
    const out = generateBootPlugin(
      { fronds: { '@fougere/log': 'logs/app.jsonl', './fronds/audit.ts': {} } } as FougereConfig,
      [], '/app/boot', [], undefined, '/app');

    expect(out).toContain("import * as module_0 from '@fougere/log';");
    expect(out).toContain("import * as module_1 from '/app/fronds/audit';");
    expect(out).toContain('const modules = { "@fougere/log": module_0, "./fronds/audit.ts": module_1 };');
    expect(out).toContain('setModuleLoader((id, options) =>');
  });
});
