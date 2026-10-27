import { describe, it, expect } from 'vitest';
import { Collect, collectorKeyOf } from '../src/prefab/collector.js';
import { builtOn, targetOf } from '../src/prefab/prefab.js';

/** No fields, no `getFields` — what a per-call value looks like. */
class Ability {
  can(_action: string, _subject: unknown): boolean { return false; }
}

describe('Collector', () => {
  it('is built on a target that carries no schema, which the written class does not hold', () => {
    class AbilityCollector extends Collect<Ability> {
      async collect() { return new Ability(); }
    }
    expect(targetOf(AbilityCollector)).toBeUndefined();
    expect(targetOf(builtOn(AbilityCollector, Ability as never))).toBe(Ability);
  });

  it('keys it by the type name, like any other', () => {
    expect(collectorKeyOf('ability')).toBe('AbilityCollector');
    expect(collectorKeyOf('authorUser')).toBe('AuthorUserCollector');
  });
});
