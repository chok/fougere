import { describe, it, expect } from 'vitest';
import { validateFields, text, number, date, optional, updated, immutable, oneOf, readOnly } from '../src/index.js';

// Locks the 5 tricky paths of the native validator (no zod underneath anymore).
describe('validation — edge cases', () => {
  it('coerces a date-string to a Date in the output', () => {
    const r = validateFields({ when: date() }, { when: '2026-05-29T10:00:00Z' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.when).toBeInstanceOf(Date);
  });

  it('rejects an invalid date-string', () => {
    expect(validateFields({ when: date() }, { when: 'not-a-date' }).success).toBe(false);
  });

  it('passes a Date instance through unchanged', () => {
    const d = new Date();
    const r = validateFields({ when: date() }, { when: d });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.when).toBe(d);
  });

  it('rejects NaN for a number field', () => {
    expect(validateFields({ n: number() }, { n: NaN }).success).toBe(false);
  });

  it('rejects a non-integer when integer is required', () => {
    expect(validateFields({ n: number({ integer: true }) }, { n: 1.5 }).success).toBe(false);
    expect(validateFields({ n: number({ integer: true }) }, { n: 2 }).success).toBe(true);
  });

  it('treats empty string as present (fails min, passes without min)', () => {
    expect(validateFields({ t: text({ min: 1 }) }, { t: '' }).success).toBe(false);
    expect(validateFields({ t: text() }, { t: '' }).success).toBe(true);
  });

  it('nullable+optional: absent is omitted (not nulled), explicit null and value both pass', () => {
    const fields = { t: optional(text()) };
    const absent = validateFields(fields, {});
    expect(absent.success).toBe(true);
    if (absent.success) expect('t' in absent.data).toBe(false); // absence ≈ null: omitted, DB defaults it
    expect(validateFields(fields, { t: null }).success).toBe(true);  // explicit null still allowed
    expect(validateFields(fields, { t: 'x' }).success).toBe(true);
  });

  it("updated(): absence is legal in create and patch — storage stamps, not validation", () => {
    const fields = { title: text(), updatedAt: updated() };
    const create = validateFields(fields, { title: 'x' });
    expect(create.success).toBe(true);
    if (create.success) expect('updatedAt' in create.data).toBe(false);
    const patch = validateFields(fields, { title: 'x' }, { patch: true });
    expect(patch.success).toBe(true);
    if (patch.success) expect('updatedAt' in patch.data).toBe(false);
  });

  it("immutable(): re-supplied in a patch → 'Immutable'; create accepts; absent patch untouched", () => {
    const fields = { slug: immutable(text()), title: text() };
    expect(validateFields(fields, { slug: 'a', title: 'x' }).success).toBe(true); // create
    const patch = validateFields(fields, { slug: 'b' }, { patch: true });
    expect(patch.success).toBe(false);
    if (!patch.success) expect(patch.errors[0]).toEqual({ path: 'slug', message: 'Immutable' });
    expect(validateFields(fields, { title: 'y' }, { patch: true }).success).toBe(true);
  });

  it('nullable field with a default: the default rule survives optional() (order fixed)', () => {
    const fields = { t: optional(text({ default: 'draft' })) };
    // The rule kept is the default, not 'optional' — storage will fill 'draft',
    // not leave null. Validation itself only judges: absent is legal, omitted.
    expect(fields.t.lifecycle?.create).toEqual({ value: 'draft' });
    const absent = validateFields(fields, {});
    expect(absent.success).toBe(true);
    if (absent.success) expect('t' in absent.data).toBe(false);
  });

  it('oneOf with a default — same option as text/number/bool, same lifecycle rule', () => {
    const fields = { status: oneOf('draft', 'published', { default: 'draft' }) };
    expect(fields.status.lifecycle?.create).toEqual({ value: 'draft' });
    expect(validateFields(fields, {}).success).toBe(true);
    expect(validateFields(fields, { status: 'published' }).success).toBe(true);
    expect(validateFields(fields, { status: 'archived' }).success).toBe(false);
  });

  it('readOnly(oneOf) — a server-owned enum: supplied in create or patch is an error', () => {
    const fields = { status: readOnly(oneOf('draft', 'published', { default: 'draft' })) };
    expect(validateFields(fields, {}).success).toBe(true);
    const create = validateFields(fields, { status: 'published' });
    expect(create.success).toBe(false);
    const patch = validateFields(fields, { status: 'published' }, { patch: true });
    expect(patch.success).toBe(false);
  });

  it("unknown key → 'Unknown field' — refused, never stripped, create and patch alike", () => {
    const fields = { title: text() };
    const create = validateFields(fields, { title: 'x', status: 'published' });
    expect(create.success).toBe(false);
    if (!create.success) expect(create.errors[0]).toEqual({ path: 'status', message: 'Unknown field' });
    const patch = validateFields(fields, { titel: 'typo' }, { patch: true });
    expect(patch.success).toBe(false);
    if (!patch.success) expect(patch.errors[0]).toEqual({ path: 'titel', message: 'Unknown field' });
    expect(validateFields(fields, { title: 'x' }).success).toBe(true);
  });
});
