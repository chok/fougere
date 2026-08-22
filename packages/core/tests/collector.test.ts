import { describe, it, expect } from 'vitest';
import { Collector, collectorKeyOf } from '../src/prefab/collector.js';
import { targetOf } from '../src/prefab/prefab.js';

/** No fields, no `getFields` — what a per-call value looks like. */
class Ability {
  can(_action: string, _subject: unknown): boolean { return false; }
}

describe('Collector', () => {
  it('records a target that carries no schema', () => {
    class AbilityCollector extends Collector(Ability) {
      async collect() { return new Ability(); }
    }
    expect(targetOf(AbilityCollector)).toBe(Ability);
  });

  it('keys it by the type name, like any other', () => {
    expect(collectorKeyOf('ability')).toBe('AbilityCollector');
    expect(collectorKeyOf('authorUser')).toBe('AuthorUserCollector');
  });
});
