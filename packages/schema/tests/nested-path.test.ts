/**
 * A refusal says WHERE, all the way down.
 *
 * `json(Address)` builds the inner shape, so the engine already knew the refusal was at
 * `street` — and `FieldValueValidator` took `errors[0].error` and dropped the rest. That cost
 * twice: the path stopped at the field, and `errors[0]` on a nested shape is the parent's
 * `Property "street" does not match schema.`, which is true and never the reason.
 *
 * The path is segments because a field may legally be named `a.b`; joining and re-splitting
 * invents a segment the validator never made.
 */
import { describe, it, expect } from 'vitest';
import { entity, json, number, primary, text, dotted } from '../src/index.js';

class Address extends entity({ street: text({ min: 3 }), zip: number() }) {}
class Contact extends entity({ id: primary(), addr: json(Address) }) {}

const refusalOf = (input: Record<string, unknown>) => {
  const result = Contact.validate(input);
  if (result.success) throw new Error('expected a refusal');

  return result.errors[0]!;
};

describe('a refusal inside a nested object', () => {
  it('names the field under the field, not just the field', () => {
    expect(refusalOf({ id: '1', addr: { street: 'a', zip: 75000 } }).path).toEqual(['addr', 'street']);
  });

  it('gives the reason the shape refused, not the parent complaint', () => {
    // `Property "street" does not match schema.` is what `errors[0]` used to answer.
    expect(refusalOf({ id: '1', addr: { street: 'a', zip: 75000 } }).message).toMatch(/too short/);
  });

  it('reaches whichever key failed', () => {
    const refusal = refusalOf({ id: '1', addr: { street: 'rue Vaugirard', zip: 'nope' } });

    expect(refusal.path).toEqual(['addr', 'zip']);
    expect(refusal.message).toMatch(/Expected "number"/);
  });

  it('stops at the field when the field itself is refused', () => {
    expect(refusalOf({ id: '1', addr: 'not an object' }).path).toEqual(['addr']);
  });

  it('is empty when the input itself is refused', () => {
    const result = Contact.validate('not an object');
    expect(result.success === false && result.errors[0]!.path).toEqual([]);
  });

  it('writes as a message names it', () => {
    expect(dotted(refusalOf({ id: '1', addr: { street: 'a', zip: 1 } }).path)).toBe('addr.street');
  });
});

describe('a field whose name holds a dot', () => {
  class Odd extends entity({ id: primary(), 'a.b': text({ min: 3 }) }) {}

  it('stays one segment — the path is never re-parsed', () => {
    const result = Odd.validate({ id: '1', 'a.b': 'x' });
    expect(result.success === false && result.errors[0]!.path).toEqual(['a.b']);
  });
});
