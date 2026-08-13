import { describe, expect, it } from 'vitest';
import {
  bool, created, date, entity, immutable, json, list, many, number, oneOf,
  optional, primary, ref, text, updated,
} from '../src/index.js';

/**
 * ONE statement of "absence is legal here", and it lives on the lifecycle:
 *
 *     lifecycle.create !== undefined
 *
 * There used to be a second — a `Field<T, A>` type parameter carrying the same fact,
 * restated by hand in every word that could set the rule. Two copies of one fact drift,
 * and this one had: `text({ default: 'x' })` typed the field as required while
 * `validate({})` succeeded. Same declaration, two answers, nothing failing to say so.
 *
 * The copy is gone, so this test has no type half to write — there is nothing left to
 * compare the lifecycle AGAINST. It reads the rule and the judge that acts on it, which
 * is the whole surface now.
 */

class Target extends entity({ id: primary() }) {}

/** Every word, paired with whether it should answer a create rule. */
const words: ReadonlyArray<readonly [string, { lifecycle?: { create?: unknown } }, boolean]> = [
  // no rule — the caller must supply a value
  ['text()', text(), false],
  ['text({min})', text({ min: 1 }), false],
  ['number()', number(), false],
  ['bool()', bool(), false],
  ['date()', date(), false],
  ['json()', json(), false],
  ['list(text())', list(text()), false],
  ['oneOf(a,b)', oneOf('a', 'b'), false],
  ['ref(T)', ref(Target), false],
  ['many(T)', many(Target), false],
  ['immutable(text())', immutable(text()), false],

  // a rule — absence is legal, in one of the four forms
  ['text({default})', text({ default: 'x' }), true],
  ['number({default})', number({ default: 1 }), true],
  ['bool({default})', bool({ default: true }), true],
  ['oneOf(a,b,{default})', oneOf('a', 'b', { default: 'a' }), true],
  ['primary()', primary(), true],
  ['created()', created(), true],
  ['updated()', updated(), true],
  ['optional(text())', optional(text()), true],
];

describe('auto-at-creation', () => {
  it.each(words)('%s states a create rule: %o → %s', (_name, field, expected) => {
    expect(field.lifecycle?.create !== undefined).toBe(expected);
  });

  it('a create rule is what makes an absent value legal, whatever its form', () => {
    class Post extends entity({
      id: primary(),                          // { generate }
      at: created(),                          // 'now'
      title: text({ default: 'sans titre' }), // { value }
      note: optional(text()),                 // 'optional'
      body: text(),                           // no rule
    }) {}

    expect(Post.validate({ body: 'b' }).success).toBe(true);

    const missing = Post.validate({});
    expect(missing.success).toBe(false);
    if (!missing.success) expect(missing.errors).toEqual([{ path: 'body', message: 'Required' }]);
  });

  it('a promoted primary keeps its own rule — `primary(field)` generates nothing', () => {
    // The overload that takes a field states the identity role and immutability, and
    // deliberately no `create`: the value is supplied, not generated.
    expect(primary(text()).lifecycle?.create).toBeUndefined();
    expect(primary().lifecycle?.create).toEqual({ generate: 'cuid2' });
  });
});
