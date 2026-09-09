/**
 * A comparison and a value that IS an object, told apart.
 *
 * `whereAll` and `matches` both said "array → set, otherwise value". Adding
 * "object → comparisons" to that would make a stored object unfilterable the day its keys
 * happened to spell an operator — `json()` admits any shape. So the FIELD decides, which
 * is the same rule the repository applies everywhere else: a thing is known by its shape,
 * and here the shape that matters is the field's.
 */
import { describe, expect, it } from 'vitest';
import { json, number, optional, text } from '@fougere/schema';

import { comparisonOf, comparisonsIn, unknownIn } from '../src/storage/criterion.js';

describe('a criterion names a comparison, or a value', () => {
  it('reads an object as comparisons on an ordinary field', () => {
    expect(comparisonOf(number(), { gte: 1500 })).toEqual({ gte: 1500 });
  });

  it('reads it as a VALUE on a field that stores objects', () => {
    expect(comparisonOf(json(), { gte: 1500 })).toBeUndefined();
  });

  it('still reads it as a value when the json field is optional', () => {
    expect(comparisonOf(optional(json()), { gte: 1 })).toBeUndefined();
  });

  it('leaves a bare value alone', () => {
    expect(comparisonOf(number(), 1500)).toBeUndefined();
    expect(comparisonOf(text(), 'house')).toBeUndefined();
  });

  it('leaves a set alone — an array already means membership', () => {
    expect(comparisonOf(text(), ['a', 'b'])).toBeUndefined();
  });

  it('leaves null alone', () => {
    expect(comparisonOf(number(), null)).toBeUndefined();
  });

  it('says nothing about a field the entity does not declare', () => {
    expect(comparisonOf(undefined, { gte: 1 })).toBeUndefined();
  });
});

describe('what a comparison names', () => {
  it('keeps the comparisons, in the order they were written', () => {
    expect(comparisonsIn({ gte: 1, lte: 9 })).toEqual([['gte', 1], ['lte', 9]]);
  });

  it('names what this vocabulary does not know — a typo, said as one', () => {
    expect(unknownIn({ gte: 1, gtee: 9 } as never)).toEqual(['gtee']);
  });
});
