import { describe, it, expect } from 'vitest';
import { Anatomy } from '../src/axis/shape/Shape.js';
import { entity } from '../src/entity.js';
import { Schema } from '../src/schema/Schema.js';
import { primary } from '../src/vocabulary/primary.js';
import { text } from '../src/vocabulary/text.js';
import { number } from '../src/vocabulary/number.js';
import { oneOf } from '../src/vocabulary/oneOf.js';
import { created } from '../src/vocabulary/created.js';
import { optional } from '../src/vocabulary/optional.js';

class Order extends entity({
  id: primary(),
  status: oneOf('pending', 'paid', 'shipped'),
  total: number({ min: 0 }),
  note: text(),
  createdAt: created(),
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
      expect(Anatomy.isNullable(view.getFields().note.shape)).toBe(false);
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
      const view = Order.omit('createdAt').extend({ updatedAt: created() });
      const fields = view.getFields();
      // The TYPE already proves `createdAt` is gone — reading it would not compile.
      // What remains to check is the runtime map, so ask it for its keys.
      expect(Object.keys(fields)).not.toContain('createdAt');
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

  describe('Schema.compose()', () => {
    class Pagination extends entity({ page: number({ min: 1, default: 1 }) }) {}

    it('merges fields left to right, later wins', () => {
      const view = Schema.compose(Order.pick('status'), Pagination);
      expect(Object.keys(view.getFields())).toEqual(['status', 'page']);
      const conflict = Schema.compose(Order.pick('note'), entity({ note: number() }));
      expect(conflict.getFields().note.shape?.type).toBe('number');
    });

    it('applies the same merge law to opts — a patch view stays patch', () => {
      const view = Schema.compose(Order.pick('status', 'note').partial(), Pagination);
      expect(view.getOpts().patch).toBe(true);
      const result = view.validate({ status: 'paid' });
      expect(result.success).toBe(true);
      if (result.success) expect('note' in result.data).toBe(false);
    });

    it('applies the same merge law per adapter, per field — later wins', () => {
      const A = entity({ a: text(), shared: text() }, { adapters: { sql: { a: { columnType: 'x' }, shared: { columnType: 'old' } } } } as never);
      const B = entity({ b: text(), shared: text() }, { adapters: { sql: { shared: { columnType: 'new' } } } } as never);
      const h = Schema.compose(A, B).getAdapters() as Record<string, Record<string, { columnType: string }>> | undefined;
      expect(h?.sql?.a?.columnType).toBe('x');
      expect(h?.sql?.shared?.columnType).toBe('new');
    });
  });

  describe('the trace a derivation leaves', () => {
    it('says what survived and what did not, keyed by the origin', () => {
      const view = Order.pick('id', 'status');
      expect(view.derivation?.survived).toEqual({
        id: 'id', status: 'status', total: undefined, note: undefined, createdAt: undefined,
      });
    });

    it('reports against the origin, never the intermediate', () => {
      const view = Order.pick('id', 'status', 'total').omit('total');
      expect(view.derivation?.source).toBe(Order);
      expect(view.derivation?.survived).toEqual({
        id: 'id', status: 'status', total: undefined, note: undefined, createdAt: undefined,
      });
    });

    it('carries the new name a rename gave a field', () => {
      const view = Order.rename({ note: 'comment' });
      expect(view.derivation?.survived.note).toBe('comment');
    });

    it('speaks of the source only — an added field has no origin', () => {
      const view = Order.pick('id').extend({ at: created() });
      expect(Object.keys(view.getFields())).toEqual(['id', 'at']);
      expect(view.derivation?.survived).toEqual({
        id: 'id', status: undefined, total: undefined, note: undefined, createdAt: undefined,
      });
    });

    it('is absent on a declaration that derives from nothing', () => {
      expect(Order.derivation).toBeUndefined();
    });
  });
});
