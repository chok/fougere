import { describe, it, expect } from 'vitest';
import { entity, compose, primary, text, number, oneOf, auto, optional, isNullable } from '../src/index.js';

class Order extends entity({
  id: primary(),
  status: oneOf('pending', 'paid', 'shipped'),
  total: number({ min: 0 }),
  note: text(),
  createdAt: auto(),
}) {}

describe('derivation', () => {
  describe('pick()', () => {
    it('keeps only selected fields', () => {
      const view = Order.pick('id', 'status');
      const fields = view.getFields();
      expect(Object.keys(fields)).toEqual(['id', 'status']);
    });

    it('validates against picked fields only', () => {
      const view = Order.pick('id', 'status');
      const result = view.validate({ id: '1', status: 'pending' });
      expect(result.success).toBe(true);
    });

    it('rejects missing picked fields', () => {
      const view = Order.pick('id', 'status');
      const result = view.validate({ id: '1' });
      expect(result.success).toBe(false);
    });
  });

  describe('omit()', () => {
    it('removes selected fields', () => {
      const view = Order.omit('createdAt', 'note');
      const fields = view.getFields();
      expect(Object.keys(fields)).toEqual(['id', 'status', 'total']);
    });
  });

  describe('partial()', () => {
    it('moves the presence axis, never the nullity axis', () => {
      const view = Order.partial();
      // patch mode is carried by the view's opts, not by mutated fields
      expect(view.getOpts().patch).toBe(true);
      // base fields are untouched — note: text() stays non-nullable
      expect(isNullable(view.getFields().note.shape)).toBe(false);
    });

    it('omits an absent field instead of touching it', () => {
      const result = Order.partial().validate({ status: 'paid' });
      expect(result).toEqual({ success: true, data: { status: 'paid' } });
    });

    it('rejects null on a non-nullable field (a patch cannot erase it)', () => {
      const result = Order.partial().validate({ note: null });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors[0]).toMatchObject({ path: 'note' });
      }
    });

    it('accepts null on a nullable field (legal erase)', () => {
      class Draft extends entity({
        id: primary(),
        label: optional(text()),
      }) {}
      const result = Draft.partial().validate({ label: null });
      expect(result).toEqual({ success: true, data: { label: null } });
    });

    it('validates with missing fields', () => {
      const view = Order.partial();
      const result = view.validate({});
      expect(result.success).toBe(true);
    });

    it('omits unsent fields instead of nulling them (patch semantics)', () => {
      const view = Order.pick('status', 'note').partial();
      const result = view.validate({ status: 'paid' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ status: 'paid' }); // note NOT present, not null
        expect('note' in result.data).toBe(false);
      }
    });
  });

  describe('extend()', () => {
    it('adds new fields', () => {
      const view = Order.extend({ customerName: text() });
      const fields = view.getFields();
      expect(fields.customerName).toBeDefined();
      expect(fields.id).toBeDefined();
    });

    it('overrides existing fields', () => {
      const view = Order.extend({ total: text() });
      const fields = view.getFields();
      expect(fields.total.shape?.type).toBe('string');
    });
  });

  describe('from()', () => {
    it('projects picked fields', () => {
      const view = Order.pick('id', 'status');
      const result = view.from({
        id: '1',
        status: 'pending',
        total: 100,
        note: 'hello',
      });
      expect(result).toEqual({ id: '1', status: 'pending' });
    });
  });

  describe('chaining', () => {
    it('pick then partial', () => {
      const view = Order.pick('id', 'status').partial();
      const result = view.validate({ status: 'pending' });
      expect(result.success).toBe(true);
      // The picked id stays introspectable, but re-supplying it in a patch is
      // rejected — primary() is immutable by default (2026-07-15).
      const withId = view.validate({ id: '1' });
      expect(withId.success).toBe(false);
    });

    it('omit then extend', () => {
      const view = Order.omit('createdAt').extend({ updatedAt: auto() });
      const fields = view.getFields();
      expect(fields.createdAt).toBeUndefined();
      expect(fields.updatedAt).toBeDefined();
    });

    // The derivation invariant, one level above cloneField: a derivation preserves
    // what it doesn't change. `patch` set by partial() must survive any further step.
    it('partial then pick keeps patch semantics', () => {
      const view = Order.partial().pick('status', 'note');
      expect(view.getOpts().patch).toBe(true);
      const result = view.validate({ status: 'paid' });
      expect(result.success).toBe(true);
      if (result.success) expect('note' in result.data).toBe(false); // omitted, not nulled
    });

    it('partial then rename/extend keeps patch semantics', () => {
      expect(Order.partial().rename({ note: 'comment' }).getOpts().patch).toBe(true);
      expect(Order.partial().extend({ extra: text() }).getOpts().patch).toBe(true);
    });
  });

  describe('compose()', () => {
    class Pagination extends entity({ page: number({ min: 1, default: 1 }) }) {}

    it('merges fields left to right, later wins', () => {
      const view = compose(Order.pick('status'), Pagination);
      expect(Object.keys(view.getFields())).toEqual(['status', 'page']);
      const conflict = compose(Order.pick('note'), entity({ note: number() }));
      expect(conflict.getFields().note.shape?.type).toBe('number');
    });

    it('applies the same merge law to opts — a patch view stays patch', () => {
      const view = compose(Order.pick('status', 'note').partial(), Pagination);
      expect(view.getOpts().patch).toBe(true);
      const result = view.validate({ status: 'paid' });
      expect(result.success).toBe(true);
      if (result.success) expect('note' in result.data).toBe(false);
    });

    it('applies the same merge law to hints — per adapter, per field, later wins', () => {
      const A = entity({ a: text(), shared: text() }, { drizzle: { a: { columnType: 'x' }, shared: { columnType: 'old' } } } as never);
      const B = entity({ b: text(), shared: text() }, { drizzle: { shared: { columnType: 'new' } } } as never);
      const h = compose(A, B).getHints() as Record<string, Record<string, { columnType: string }>> | undefined;
      expect(h?.drizzle?.a?.columnType).toBe('x');
      expect(h?.drizzle?.shared?.columnType).toBe('new');
    });
  });
});
