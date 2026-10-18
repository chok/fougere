/** The terms a schema names by their name — read off its fields, answered or not by this process. */
import { describe, it, expect } from 'vitest';
import { entity, primary, text, NamedTerm } from '../src/index.js';

class Card extends entity({ id: primary(), mail: text({ format: 'email' }), code: text({ format: 'isbn13' }) }) {}

describe('NamedTerm.in', () => {
  it('reads every format and generator the fields name', () => {
    expect(NamedTerm.in(Card).map((term) => [term.field, term.kind, term.name])).toEqual([
      ['id', 'generator', 'cuid2'],
      ['mail', 'format', 'email'],
      ['code', 'format', 'isbn13'],
    ]);
  });

  it('says which of them the process answers', () => {
    expect(NamedTerm.in(Card).map((term) => term.answered())).toEqual([true, true, false]);
  });
});
