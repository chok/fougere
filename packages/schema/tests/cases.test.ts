/**
 * The decision table, checked against the judge it describes.
 *
 * Every case is posed to `InputValidator.check` — the same function the façade calls. A case whose
 * verdict the judge does not share is a case this file got wrong, and the assertion says
 * which one by carrying `why`.
 */
import { describe, it, expect } from 'vitest';
import {
  entity, primary, text, number, oneOf, bool, email, created, immutable, readOnly, list, InputValidator,
  Cases,
} from '../src/index.js';

class Article extends entity({
  id: primary(),
  title: text({ min: 3, max: 40 }),
  body: text({ min: 1 }),
  status: oneOf('draft', 'published'),
  views: number({ integer: true, min: 0, max: 1000 }),
  featured: bool(),
  contact: email(),
  tags: list(text({ min: 1 }), { min: 1 }),
  slug: readOnly(text()),
  reference: immutable(text({ min: 2 })),
  createdAt: created(),
}) {}

// The valid body is handed IN: deriving the cases reads the axes, inventing a value needs
// a generator, and only the second belongs outside this package.
const baseline = {
  title: 'A stated title', body: 'A body', status: 'draft', views: 3,
  featured: false, contact: 'a@b.co', tags: ['one'], reference: 'AB',
};
const table = Cases.of(Article, baseline).all;
const verdict = (body: unknown, patch: boolean) =>
  InputValidator.of(Article.getFields(), { patch }).validate(body);

describe('the table', () => {
  it('is not empty — a table that silently drains proves nothing', () => {
    expect(table.length).toBeGreaterThanOrEqual(10);
  });

  it('states a valid body, a key outside the contract, and a non-object', () => {
    const reasons = table.map((one) => one.why);

    expect(reasons).toContain('a valid body');
    expect(reasons).toContain('a key outside the contract');
    expect(reasons).toContain('not an object at all');
  });

  it('covers every refusal the judge can state', () => {
    const messages = new Set<string>();
    for (const one of table) {
      const result = verdict(one.body, one.patch);
      if (!result.success) for (const error of result.errors) messages.add(error.message.replace(/\(.*\)/, '').trim());
    }

    expect(messages).toContain('Unknown field');
    expect(messages).toContain('Required');
    expect(messages).toContain('Read-only');
    expect(messages).toContain('Immutable');
    expect(messages).toContain('Expected an object');
    // The shape branch says many things; one of them is enough to prove it was reached.
    expect([...messages].some((m) => /expected|too|match|enum/i.test(m))).toBe(true);
  });
});

describe('each case', () => {
  it('gets from the judge the verdict it states', () => {
    for (const one of table) {
      const result = verdict(one.body, one.patch);

      expect(Cases.holds(one.expect, result), `${one.why} → ${JSON.stringify(result)}`).toBe(true);
    }
  });
});

describe('the guard on the judge itself', () => {
  it('names every refusal branch, so a new one cannot be added in silence', () => {
    // If the judge grows a branch, this fails naming it, and the table above has to state
    // the case that reaches it. Two refusals stay out on purpose: a value refused by its
    // own shape carries the engine's message, and a named boundary codec carries user
    // code's — neither is structural, and neither can be enumerated ahead of time.
    expect(Cases.refusals).toEqual([
      'Expected an object',
      'Unknown field',
      'Required',
      'Read-only',
      'Immutable',
    ]);
  });
});
