import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import {
  scanProject, frondAliases, resolveConventions, frondDirsOf, providerDirsOf,
  DEFAULT_CONVENTIONS, loadConfig,
} from '../src/node.js';

/**
 * A project that renamed every name the scan reads.
 *
 * `fronds/` is `domains/`, `entities/` is `models/`, `handlers/` is `usecases/`,
 * `services/` is `helpers/`, and the import scope is `@presse`.
 */
const renamed = join(import.meta.dirname, 'fixtures-conventions');
const conventions = {
  scope: '@presse',
  fronds: 'domains',
  dirs: { entities: 'models', handlers: 'usecases', services: 'helpers' },
};

describe('resolveConventions', () => {
  it('answers the convention when nothing is declared', () => {
    expect(resolveConventions()).toEqual(DEFAULT_CONVENTIONS);
    expect(resolveConventions({})).toEqual(DEFAULT_CONVENTIONS);
  });

  it('keeps the six other directories when one is renamed', () => {
    const resolved = resolveConventions({ dirs: { entities: 'models' } });
    expect(resolved.dirs.entities).toBe('models');
    expect(resolved.dirs.handlers).toBe('handlers');
    expect(resolved.dirs.seeds).toBe('seeds');
    expect(resolved.scope).toBe('@fronds');
  });

  /**
   * The vocabulary is DERIVED, so a renamed directory is watched and compiled under its
   * new name. `FROND_DIRS` was a constant claiming to be "every directory the scan reads"
   * while the scan re-spelled its own literals — one declaration, no reader.
   */
  it('derives the frond vocabulary from the names in force', () => {
    expect(frondDirsOf(resolveConventions(conventions)))
      .toEqual(['models', 'usecases', 'presenters', 'collectors', 'seeds', 'versions', 'helpers', 'repositories']);
  });

  it('reads one directory once when two roles name the same one', () => {
    const resolved = resolveConventions({ dirs: { services: 'providers', repositories: 'providers' } });
    expect(providerDirsOf(resolved)).toEqual(['providers']);
  });
});

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
