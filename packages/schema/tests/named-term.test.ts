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

describe('NamedTerm.in, on a boundary', () => {
  it('reads the alias a field names, then the codecs its rules name once it is answered', async () => {
    const { Field, Boundaries } = await import('../src/index.js');
    class Price extends entity({ id: primary(), cents: new Field<number>({ shape: { type: 'number' }, boundary: 'priceCents' }) }) {}
    const named = () => NamedTerm.in(Price).filter((term) => term.field === 'cents').map((term) => [term.kind, term.name, term.answered()]);

    expect(named()).toEqual([['boundary', 'priceCents', false]]);

    Boundaries.aliases.register('priceCents', { in: { decode: 'priceFromCents' } });

    expect(named()).toEqual([['boundary', 'priceCents', true], ['decoder', 'priceFromCents', false]]);
  });
});
