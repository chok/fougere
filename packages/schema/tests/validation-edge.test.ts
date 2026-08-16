import { Judge } from '../src/judge/Judge.js';
import { describe, it, expect } from 'vitest';
import { text } from '../src/vocabulary/text.js';
import { number } from '../src/vocabulary/number.js';
import { date } from '../src/vocabulary/date.js';
import { optional } from '../src/vocabulary/optional.js';
import { updated } from '../src/vocabulary/updated.js';
import { immutable } from '../src/vocabulary/immutable.js';
import { oneOf } from '../src/vocabulary/oneOf.js';
import { readOnly } from '../src/vocabulary/readOnly.js';

// Locks the 5 tricky paths of the native validator (no zod underneath anymore).
describe('validation — edge cases', () => {
  it('coerces a date-string to a Date in the output', () => {
    const r = Judge.row({ when: date() }, { when: '2026-05-29T10:00:00Z' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.when).toBeInstanceOf(Date);
  });

  it('rejects an invalid date-string', () => {
    expect(Judge.row({ when: date() }, { when: 'not-a-date' }).success).toBe(false);
  });

  it('passes a Date instance through unchanged', () => {
    const d = new Date();
    const r = Judge.row({ when: date() }, { when: d });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.when).toBe(d);
  });

  it('rejects NaN for a number field', () => {
    expect(Judge.row({ n: number() }, { n: NaN }).success).toBe(false);
  });

  it('rejects a non-integer when integer is required', () => {
    expect(Judge.row({ n: number({ integer: true }) }, { n: 1.5 }).success).toBe(false);
    expect(Judge.row({ n: number({ integer: true }) }, { n: 2 }).success).toBe(true);
  });

  it('treats empty string as present (fails min, passes without min)', () => {
    expect(Judge.row({ t: text({ min: 1 }) }, { t: '' }).success).toBe(false);
    expect(Judge.row({ t: text() }, { t: '' }).success).toBe(true);
  });

  it('nullable+optional: absent is omitted (not nulled), explicit null and value both pass', () => {
    const fields = { t: optional(text()) };
    const absent = Judge.row(fields, {});
    expect(absent.success).toBe(true);
    if (absent.success) expect('t' in absent.data).toBe(false); // absence ≈ null: omitted, DB defaults it
    expect(Judge.row(fields, { t: null }).success).toBe(true);  // explicit null still allowed
    expect(Judge.row(fields, { t: 'x' }).success).toBe(true);
  });

  it("updated(): absence is legal in create and patch — storage stamps, not validation", () => {
    const fields = { title: text(), updatedAt: updated() };
    const create = Judge.row(fields, { title: 'x' });
    expect(create.success).toBe(true);
    if (create.success) expect('updatedAt' in create.data).toBe(false);
    const patch = Judge.row(fields, { title: 'x' }, { patch: true });
    expect(patch.success).toBe(true);
    if (patch.success) expect('updatedAt' in patch.data).toBe(false);
  });

  it("immutable(): re-supplied in a patch → 'Immutable'; create accepts; absent patch untouched", () => {
    const fields = { slug: immutable(text()), title: text() };
    expect(Judge.row(fields, { slug: 'a', title: 'x' }).success).toBe(true); // create
    const patch = Judge.row(fields, { slug: 'b' }, { patch: true });
    expect(patch.success).toBe(false);
    if (!patch.success) expect(patch.errors[0]).toEqual({ path: 'slug', message: 'Immutable' });
    expect(Judge.row(fields, { title: 'y' }, { patch: true }).success).toBe(true);
  });

  it('nullable field with a default: the default rule survives optional() (order fixed)', () => {
    const fields = { t: optional(text({ default: 'draft' })) };
    // The rule kept is the default, not 'optional' — storage will fill 'draft',
    // not leave null. Validation itself only judges: absent is legal, omitted.
    expect(fields.t.lifecycle?.create).toEqual({ value: 'draft' });
    const absent = Judge.row(fields, {});
    expect(absent.success).toBe(true);
    if (absent.success) expect('t' in absent.data).toBe(false);
  });

  it('oneOf with a default — same option as text/number/bool, same lifecycle rule', () => {
    const fields = { status: oneOf('draft', 'published', { default: 'draft' }) };
    expect(fields.status.lifecycle?.create).toEqual({ value: 'draft' });
    expect(Judge.row(fields, {}).success).toBe(true);
    expect(Judge.row(fields, { status: 'published' }).success).toBe(true);
    expect(Judge.row(fields, { status: 'archived' }).success).toBe(false);
  });

  it('readOnly(oneOf) — a server-owned enum: supplied in create or patch is an error', () => {
    const fields = { status: readOnly(oneOf('draft', 'published', { default: 'draft' })) };
    expect(Judge.row(fields, {}).success).toBe(true);
    const create = Judge.row(fields, { status: 'published' });
    expect(create.success).toBe(false);
    const patch = Judge.row(fields, { status: 'published' }, { patch: true });
    expect(patch.success).toBe(false);
  });

  it("unknown key → 'Unknown field' — refused, never stripped, create and patch alike", () => {
    const fields = { title: text() };
    const create = Judge.row(fields, { title: 'x', status: 'published' });
    expect(create.success).toBe(false);
    if (!create.success) expect(create.errors[0]).toEqual({ path: 'status', message: 'Unknown field' });
    const patch = Judge.row(fields, { titel: 'typo' }, { patch: true });
    expect(patch.success).toBe(false);
    if (!patch.success) expect(patch.errors[0]).toEqual({ path: 'titel', message: 'Unknown field' });
    expect(Judge.row(fields, { title: 'x' }).success).toBe(true);
  });
});
