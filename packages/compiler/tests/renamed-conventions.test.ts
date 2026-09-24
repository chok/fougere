import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { resolveConventions } from '@fougere/core';
import { loadConfig } from '@fougere/core/node';
import { scanProject, frondAliases } from '../src/index.js';

/**
 * A project that renamed every name the scan reads.
 *
 * `fronds/` is `domains/`, `entities/` is `models/`, `handlers/` is `usecases/`,
 * `services/` is `helpers/`, and the import scope is `@presse`.
 */
const renamed = join(import.meta.dirname, 'fixtures-renamed-conventions');
const conventions = {
  scope: '@presse',
  fronds: 'domains',
  dirs: { entities: 'models', handlers: 'usecases', services: 'helpers' },
};

describe('a project that renamed the convention', () => {
  it('is scanned under the names it declares', async () => {
    const { fronds } = await scanProject(renamed, undefined, conventions);

    expect(fronds.map((f) => f.name)).toEqual(['press']);
    const press = fronds[0]!;
    expect(press.entities.map((e) => (e.entityClass as { name: string }).name)).toEqual(['Article']);
    expect(press.handlers.map((h) => h.ctor.name)).toEqual(['ArticleHandler']);
    expect(press.providers.map((p) => p.ctor.name)).toEqual(['Wordcount']);
  });

  /** The scope reaches `FrondSource.package`, which is what every writer of a name reads. */
  it('carries the declared scope on the frond it found', async () => {
    const { fronds } = await scanProject(renamed, undefined, conventions);
    expect(fronds[0]!.source.package).toBe('@presse/press');
  });

  /**
   * The file→value link. `frondsDir` was declared in `FougereConfig` and read by nobody
   * for as long as it existed; what stops that repeating is asserting the read.
   */
  it('is what the config file says', async () => {
    expect((await loadConfig(renamed)).conventions).toEqual(conventions);
  });

  it('resolves an import under the declared scope', async () => {
    expect(await frondAliases(renamed, resolveConventions(conventions)))
      .toEqual({ '@presse/press': join(renamed, 'domains', 'press') });
  });

  /**
   * The same directory tree, read with the convention: nothing is found. What proves the
   * names above were read rather than guessed from the shape of the files.
   */
  it('finds nothing when the declaration is ignored', async () => {
    expect((await scanProject(renamed)).fronds).toEqual([]);
  });
});
