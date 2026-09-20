/**
 * What a word admits beyond its own shape is `Field.setShared`, so the ten words state it
 * rather than each writing the two conversions — which is how six of them came to admit
 * neither. A value is only offered by the words that shape one.
 */
import { describe, expect, it } from 'vitest';
import {
  bool, created, date, entity, json, list, many, number, oneOf, primary, ref, text, updated,
} from '../src/index.js';

class Target extends entity({ id: primary() }) {}

const words = {
  text: text({ description: 'a' }),
  number: number({ description: 'a' }),
  bool: bool({ description: 'a' }),
  date: date({ description: 'a' }),
  oneOf: oneOf('x', 'y', { description: 'a' }),
  list: list(text(), { description: 'a' }),
  json: json({ description: 'a' }),
  primary: primary({ description: 'a' }),
  ref: ref(Target, { description: 'a' }),
  many: many(Target, { description: 'a' }),
  created: created({ description: 'a' }),
  updated: updated({ description: 'a' }),
};

describe('what every word admits', () => {
  it.each(Object.entries(words))('%s carries a sentence', (_name, field) => {
    expect(field.shape?.description).toBe('a');
  });

  it('leaves what the word already stated alone', () => {
    expect(primary({ description: 'a' }).lifecycle?.create).toEqual({ generate: 'cuid2' });
    expect(ref(Target, { description: 'a' }).role?.relation?.kind).toBe('one');
  });

  it('turns a value into the create rule, for the words that shape one', () => {
    expect(date({ default: new Date(0) }).lifecycle?.create).toEqual({ value: new Date(0) });
    expect(list(text(), { default: [] }).lifecycle?.create).toEqual({ value: [] });
    expect(json({ default: { any: 1 } }).lifecycle?.create).toEqual({ value: { any: 1 } });
    expect(ref(Target, { default: 'anonymous' }).lifecycle?.create).toEqual({ value: 'anonymous' });
  });

  it('offers no value where the word has none to hold', () => {
    // @ts-expect-error a collection is not a value a caller writes
    many(Target, { default: [] });
    // @ts-expect-error a generated key already states how it is born
    primary({ default: 'x' });
    // @ts-expect-error a stamp states `create: 'now'`, so there is no value to offer
    created({ default: new Date(0) });
  });

});
