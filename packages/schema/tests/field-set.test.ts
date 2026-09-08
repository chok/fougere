import { describe, expect, it } from 'vitest';
import { entity, FieldSet, primary, text } from '../src/index.js';

describe('FieldSet', () => {
  it('answers the primary field and keeps absence explicit', () => {
    expect(FieldSet.of({ id: primary(), title: text() }).primary).toBe('id');
    expect(FieldSet.of({ title: text() }).primary).toBeUndefined();
  });

  it('refuses two primary fields and names both', () => {
    expect(() => FieldSet.of({ id: primary(), externalId: primary() }).primary)
      .toThrow(/"id".*"externalId"/);
  });

  it('leaves a composite group to the schema, which is what it constrains', () => {
    class Account extends entity(
      { tenant: text(), email: text() },
      { unique: [['tenant', 'email']] },
    ) {}

    expect(Account.getUnique()).toEqual([['tenant', 'email']]);
    expect(entity({ email: text() }).getUnique()).toBeUndefined();
  });
});
