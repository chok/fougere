/**
 * Two hazards a centralized realization creates, and where each is closed.
 *
 * Raised in review by Codex, verified here. One was reachable through the ordinary
 * vocabulary and is fixed at the write; the other is an authoring mistake and is fixed
 * at the declaration, because a static value against a static shape has a static answer.
 */
import { describe, it, expect } from 'vitest';
import { entity } from '../src/entity.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';
import { number } from '../src/vocabulary/number.js';
import { created } from '../src/vocabulary/created.js';
import { updated } from '../src/vocabulary/updated.js';
import { applyCreate, applyUpdate } from '../src/axis/lifecycle/apply.js';

class Doc extends entity({
  id: primary(),
  title: text(),
  createdAt: created(),
  updatedAt: updated(),
}) {}

describe('a stamp is one instant, but never one object', () => {
  it('gives each field its own Date', () => {
    const row = applyCreate(Doc.getFields(), { title: 'x' });
    const created = row.createdAt as Date;
    const updatedAt = row.updatedAt as Date;

    // Same instant: two stamps from one write must not disagree.
    expect(created.getTime()).toBe(updatedAt.getTime());
    // Different objects: `created()` is immutable, and moving `updatedAt` used to move it.
    // Invisible where a storage serializes on write (SQL), lasting where it does not.
    expect(created).not.toBe(updatedAt);

    updatedAt.setFullYear(2000);
    expect(created.getFullYear()).not.toBe(2000);
  });

  it('gives each ROW its own Date', () => {
    const a = applyCreate(Doc.getFields(), { title: 'a' }).createdAt as Date;
    const b = applyCreate(Doc.getFields(), { title: 'b' }).createdAt as Date;
    expect(a).not.toBe(b);
  });

  it('does the same on update', () => {
    const first = applyUpdate(Doc.getFields(), {}).updatedAt as Date;
    const second = applyUpdate(Doc.getFields(), {}).updatedAt as Date;
    expect(first).not.toBe(second);
  });
});

describe('a declared default is validated once, where it is written', () => {
  it('refuses a default its own shape refuses', () => {
    // `applyCreate` writes this into every row without passing the client validator — which
    // is right, the validator answers for what a CALLER sent. So the value is validated here,
    // at the declaration, instead of on every write for the rest of the app's life.
    expect(() => entity({ id: primary(), code: text({ min: 5, default: 'ab' }) }))
      .toThrow(/declared default "ab" is not a legal value/);

    expect(() => entity({ id: primary(), qty: number({ min: 0, default: -1 }) }))
      .toThrow(/declared default -1 is not a legal value/);
  });

  it('accepts a default that satisfies it', () => {
    expect(() => entity({ id: primary(), code: text({ min: 2, default: 'ab' }) })).not.toThrow();
  });

  it('a value the caller supplies is still the caller\'s to be validated elsewhere', () => {
    // The declaration guard says nothing about inputs: an illegal `title` is the
    // façade's business, and stays so.
    expect(applyCreate(Doc.getFields(), { title: '' }).title).toBe('');
  });
});
