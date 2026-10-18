/**
 * A name has one answer: the ids of an entity never come from another entity's generator.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text, Generators } from '../src/index.js';

describe('a generator name has one answer', () => {
  it('takes the same function again, from two entities sharing it', () => {
    const shared = () => 'shared-1';
    class A extends entity({ id: primary({ generate: ['sharedId', shared] }), name: text() }) {}
    class B extends entity({ id: primary({ generate: ['sharedId', shared] }), name: text() }) {}

    expect([A, B].map((one) => one.name)).toEqual(['A', 'B']);
    expect(Generators.resolve('sharedId')).toBe(shared);
  });

  it('refuses a second function under a name another entity generates with', () => {
    class C extends entity({ id: primary({ generate: ['clashId', () => 'c'] }), name: text() }) {}

    expect(C.name).toBe('C');
    expect(() => entity({ id: primary({ generate: ['clashId', () => 'd'] }), name: text() }))
      .toThrow(/Two generators are named 'clashId'/);
  });
});
