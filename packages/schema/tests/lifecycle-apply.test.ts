/**
 * The lifecycle axis, realized once for every storage.
 *
 * Before this, each adapter re-derived the rule and they drifted. Measured on one
 * entity, `oneOf('draft','published',{ default:'draft' })`: SQLite answered `'draft'`
 * (its DDL emits a column DEFAULT), MongoDB answered `undefined`, and the Nuxt module's
 * in-memory store answered `undefined` too — it ignored the entity entirely.
 *
 * These tests are what a storage adapter no longer has to write.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text, oneOf, created, updated, optional, date, number } from '../src/index.js';
import { applyCreate, applyUpdate, registerGenerator } from '../src/index.js';

class Product extends entity({
  id: primary({ generate: 'uuid' }),
  sku: text({ min: 3 }),
  status: oneOf('draft', 'published', { default: 'draft' }),
  stock: number({ default: 0 }),
  createdAt: created(),
  updatedAt: updated(),
  archivedAt: optional(date()),
}) {}

const fields = Product.getFields();

describe('applyCreate — what the system writes at creation', () => {
  it('fills the three rules and leaves the rest alone', () => {
    const row = applyCreate(fields, { sku: 'ABC-123' });

    expect(row.id).toMatch(/^[0-9a-f-]{36}$/);   // { generate }
    expect(row.status).toBe('draft');             // { value } — the one only SQL kept
    expect(row.stock).toBe(0);                    // a falsy default is still a default
    expect(row.createdAt).toBeInstanceOf(Date);   // 'now'
    expect(row.sku).toBe('ABC-123');
    // `optional()` says the system writes nothing — absence stays absence.
    expect('archivedAt' in row).toBe(false);
  });

  it('never overwrites what the caller supplied, null included', () => {
    const row = applyCreate(fields, { sku: 'A', id: 'chosen', status: 'published', archivedAt: null });

    expect(row.id).toBe('chosen');
    expect(row.status).toBe('published');
    // Presence is the test, not truthiness: an explicit null is a decision.
    expect(row.archivedAt).toBeNull();
  });

  it('stamps one instant, not one per field', () => {
    const row = applyCreate(fields, { sku: 'A' });
    expect((row.createdAt as Date).getTime()).toBe((row.updatedAt as Date).getTime());
  });

  it('hands back a Date, the value the field declares — not its wire form', () => {
    // The storage converts if its driver needs something else (`schema-sql/values.ts`).
    // Stamping an ISO string here would leak the wire form into the domain, and a
    // handler reading `row.createdAt.getFullYear()` would break on one storage only.
    expect(applyCreate(fields, { sku: 'A' }).createdAt).toBeInstanceOf(Date);
  });

  it('refuses an unknown generator instead of inventing a value', () => {
    class Odd extends entity({ id: primary({ generate: 'snowflake' }) }) {}
    expect(() => applyCreate(Odd.getFields(), {})).toThrow(/Unknown generator 'snowflake'/);
  });

  it('a registered generator now reaches every storage, not just the one that knew it', () => {
    registerGenerator('sequential', () => 'seq-1');
    class Ticket extends entity({ id: primary({ generate: 'sequential' }) }) {}
    expect(applyCreate(Ticket.getFields(), {}).id).toBe('seq-1');
  });
});

describe('applyUpdate — what the system writes at every write', () => {
  it('stamps `update: now` and touches nothing else', () => {
    const patch = applyUpdate(fields, { sku: 'NEW' });

    expect(patch.updatedAt).toBeInstanceOf(Date);
    expect(patch.sku).toBe('NEW');
    // A creation stamp is not re-written, and no default is re-applied on a patch.
    expect('createdAt' in patch).toBe(false);
    expect('status' in patch).toBe(false);
    expect('id' in patch).toBe(false);
  });

  it('accepts a supplied stamp, same rule as create', () => {
    const when = new Date('2020-01-01');
    expect(applyUpdate(fields, { updatedAt: when }).updatedAt).toBe(when);
  });

  it('does not judge — refusing an immutable field is the façade\'s job', () => {
    // `update: 'forbidden'` is enforced by `validateFields` in patch mode. A storage
    // realizes; it never refuses. Both sentences have to stay true for the split to
    // mean anything.
    expect(applyUpdate(fields, { createdAt: new Date('2020-01-01') }).createdAt)
      .toEqual(new Date('2020-01-01'));
  });
});
