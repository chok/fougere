import { describe, it, expect } from 'vitest';
import { generateBootPlugin } from '../src/module.js';
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

  it('db: false skips storage entirely', () => {
    const out = generateBootPlugin({ db: false } as FougereConfig, [], '@fougere/nuxt/fougereApp');
    expect(out).not.toContain('resolveStorage');
  });
});
