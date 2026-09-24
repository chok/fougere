import { describe, it, expect } from 'vitest';
import { resolveConventions, frondDirsOf, providerDirsOf, DEFAULT_CONVENTIONS } from '../src/index.js';

/** Every name the scan reads, renamed: `fronds/` is `domains/`, and three directories move. */
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

  it('keeps the seven other directories when one is renamed', () => {
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
  /** `vocabulary` leads, and the order is load order: an entity may name what it registers. */
  it('derives the frond vocabulary from the names in force', () => {
    expect(frondDirsOf(resolveConventions(conventions)))
      .toEqual(['vocabulary', 'models', 'usecases', 'presenters', 'collectors', 'seeds', 'middlewares', 'rules', 'versions', 'extensions', 'helpers', 'repositories']);
  });

  it('reads one directory once when two roles name the same one', () => {
    const resolved = resolveConventions({ dirs: { services: 'providers', repositories: 'providers' } });
    expect(providerDirsOf(resolved)).toEqual(['providers']);
  });
});
