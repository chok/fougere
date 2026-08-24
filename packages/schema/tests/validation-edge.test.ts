import { RowJudge } from '../src/judge/RowJudge.js';
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
    const r = RowJudge.of({ when: date() }).check({ when: '2026-05-29T10:00:00Z' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.when).toBeInstanceOf(Date);
  });

  it('rejects an invalid date-string', () => {
    expect(RowJudge.of({ when: date() }).check({ when: 'not-a-date' }).success).toBe(false);
  });

  it('passes a Date instance through unchanged', () => {
    const d = new Date();
    const r = RowJudge.of({ when: date() }).check({ when: d });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.when).toBe(d);
  });

  it('rejects NaN for a number field', () => {
    expect(RowJudge.of({ n: number() }).check({ n: NaN }).success).toBe(false);
  });

  it('rejects a non-integer when integer is required', () => {
    const judge = RowJudge.of({ n: number({ integer: true }) });
    expect(judge.check({ n: 1.5 }).success).toBe(false);
    expect(judge.check({ n: 2 }).success).toBe(true);
  });

  it('treats empty string as present (fails min, passes without min)', () => {
    expect(RowJudge.of({ t: text({ min: 1 }) }).check({ t: '' }).success).toBe(false);
    expect(RowJudge.of({ t: text() }).check({ t: '' }).success).toBe(true);
  });

  it('nullable+optional: absent is omitted (not nulled), explicit null and value both pass', () => {
    const fields = { t: optional(text()) };
    const judge = RowJudge.of(fields);
    const absent = judge.check({});
    expect(absent.success).toBe(true);
    if (absent.success) expect('t' in absent.data).toBe(false); // absence ≈ null: omitted, DB defaults it
    expect(judge.check({ t: null }).success).toBe(true);  // explicit null still allowed
    expect(judge.check({ t: 'x' }).success).toBe(true);
  });

  it("updated(): absence is legal in create and patch — storage stamps, not validation", () => {
    const fields = { title: text(), updatedAt: updated() };
    const create = RowJudge.of(fields).check({ title: 'x' });
    expect(create.success).toBe(true);
    if (create.success) expect('updatedAt' in create.data).toBe(false);
    const patch = RowJudge.of(fields, { patch: true }).check({ title: 'x' });
    expect(patch.success).toBe(true);
    if (patch.success) expect('updatedAt' in patch.data).toBe(false);
  });

  it("immutable(): re-supplied in a patch → 'Immutable'; create accepts; absent patch untouched", () => {
    const fields = { slug: immutable(text()), title: text() };
    expect(RowJudge.of(fields).check({ slug: 'a', title: 'x' }).success).toBe(true); // create
    const judge = RowJudge.of(fields, { patch: true });
    const patch = judge.check({ slug: 'b' });
    expect(patch.success).toBe(false);
    if (!patch.success) expect(patch.errors[0]).toEqual({ path: 'slug', message: 'Immutable' });
    expect(judge.check({ title: 'y' }).success).toBe(true);
  });

  it('nullable field with a default: the default rule survives optional() (order fixed)', () => {
    const fields = { t: optional(text({ default: 'draft' })) };
    // The rule kept is the default, not 'optional' — storage will fill 'draft',
    // not leave null. Validation itself only judges: absent is legal, omitted.
    expect(fields.t.lifecycle?.create).toEqual({ value: 'draft' });
    const absent = RowJudge.of(fields).check({});
    expect(absent.success).toBe(true);
    if (absent.success) expect('t' in absent.data).toBe(false);
  });

  it('oneOf with a default — same option as text/number/bool, same lifecycle rule', () => {
    const fields = { status: oneOf('draft', 'published', { default: 'draft' }) };
    expect(fields.status.lifecycle?.create).toEqual({ value: 'draft' });
    const judge = RowJudge.of(fields);
    expect(judge.check({}).success).toBe(true);
    expect(judge.check({ status: 'published' }).success).toBe(true);
    expect(judge.check({ status: 'archived' }).success).toBe(false);
  });

  it('readOnly(oneOf) — a server-owned enum: supplied in create or patch is an error', () => {
    const fields = { status: readOnly(oneOf('draft', 'published', { default: 'draft' })) };
    expect(RowJudge.of(fields).check({}).success).toBe(true);
    const create = RowJudge.of(fields).check({ status: 'published' });
    expect(create.success).toBe(false);
    const patch = RowJudge.of(fields, { patch: true }).check({ status: 'published' });
    expect(patch.success).toBe(false);
  });

  it("unknown key → 'Unknown field' — refused, never stripped, create and patch alike", () => {
    const fields = { title: text() };
    const createJudge = RowJudge.of(fields);
    const create = createJudge.check({ title: 'x', status: 'published' });
    expect(create.success).toBe(false);
    if (!create.success) expect(create.errors[0]).toEqual({ path: 'status', message: 'Unknown field' });
    const patch = RowJudge.of(fields, { patch: true }).check({ titel: 'typo' });
    expect(patch.success).toBe(false);
    if (!patch.success) expect(patch.errors[0]).toEqual({ path: 'titel', message: 'Unknown field' });
    expect(createJudge.check({ title: 'x' }).success).toBe(true);
  });
});
