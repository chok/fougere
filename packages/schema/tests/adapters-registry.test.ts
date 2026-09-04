import { describe, it, expect } from 'vitest';
import { Adapters } from '../src/entity/Adapters.js';
import { EntryJudge } from '../src/judge/EntryJudge.js';
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

const probe = Adapters.register('probe', EntryJudge.of(format));

describe('Adapters', () => {
  it('answers for a name that registered itself', () => {
    expect(Adapters.names).toContain('probe');
    expect(Adapters.find('probe')).toBe(probe);
  });

  it('answers nothing for a name this process never loaded', () => {
    expect(Adapters.find('mongo')).toBeUndefined();
  });

  it('hands back a judge that refuses an entry the format does not admit', () => {
    expect(() => probe.assert({ body: { columnTpye: {} } }, 'Post.adapters.probe')).toThrow(
      'Post.adapters.probe.body: Property "columnTpye" does not match additional properties schema.',
    );
  });
});
