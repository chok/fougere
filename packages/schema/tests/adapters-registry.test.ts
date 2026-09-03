import { describe, it, expect } from 'vitest';
import { Adapters } from '../src/entity/Adapters.js';
import type { Shape } from '../src/schema/axis/shape/Shape.js';

/**
 * The population of the FIRST level — which adapters this process answers for. An adapter
 * registers itself at its own module load, so the name an entity addresses stops being
 * implicit in whoever happens to read it.
 */
const format: Shape = {
  type: 'object',
  properties: { columnType: { type: 'object', properties: { pg: { type: 'string' } }, additionalProperties: false } },
  additionalProperties: false,
};

Adapters.register('probe', format);

describe('Adapters', () => {
  it('answers for a name that registered itself', () => {
    expect(Adapters.names).toContain('probe');
    expect(Adapters.judge('probe')).toBeDefined();
  });

  it('answers nothing for a name this process never loaded', () => {
    expect(Adapters.judge('mongo')).toBeUndefined();
  });

  it('judges an entry through the adapter that stated its format', () => {
    expect(() => Adapters.check({ probe: { body: { columnTpye: {} } } }, 'Post.adapters')).toThrow(
      'Post.adapters.probe.body: Property "columnTpye" does not match additional properties schema.',
    );
  });

  /**
   * The measured reason this is a skip and not a refusal: an entity may state a Postgres
   * column type while this app boots on `adapter/memory`, which never loads `sql`. The
   * process cannot tell that from a typo — the project can, through its dependencies.
   */
  it('skips a name no adapter here claims, rather than refusing it', () => {
    expect(() => Adapters.check({ mongo: { body: 'anything at all' } }, 'Post.adapters')).not.toThrow();
  });

  it('says nothing about an entity that stated nothing', () => {
    expect(() => Adapters.check(undefined, 'Post.adapters')).not.toThrow();
  });
});
