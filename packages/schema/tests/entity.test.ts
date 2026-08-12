import { describe, it, expect } from 'vitest';
import { entity, primary, text, number, oneOf, ref, many, created } from '../src/index.js';

class Customer extends entity({
  id: primary(),
  name: text({ min: 1 }),
  email: text(),
}) {}

class OrderLine extends entity({
  id: primary(),
  productId: text(),
  quantity: number({ min: 1 }),
  price: number({ min: 0 }),
}) {}

class Order extends entity({
  id: primary(),
  customerId: ref(Customer),
  status: oneOf('pending', 'paid', 'shipped'),
  total: number({ min: 0 }),
  lines: many(OrderLine),
  createdAt: created(),
}) {}

describe('Entity', () => {
  describe('getFields()', () => {
    it('extracts all fields from an entity', () => {
      const fields = Order.getFields();
      expect(Object.keys(fields)).toEqual([
        'id', 'customerId', 'status', 'total', 'lines', 'createdAt',
      ]);
    });

    it('returns fields decomposed on the right axes', () => {
      const fields = Order.getFields();
      expect(fields.id.role?.primary).toBe(true);
      expect(fields.customerId.role?.relation?.kind).toBe('one');
      expect(fields.status.shape).toMatchObject({ type: 'string', enum: ['pending', 'paid', 'shipped'] });
      expect(fields.total.shape?.type).toBe('number');
      expect(fields.lines.role?.relation?.kind).toBe('many');
      expect(fields.createdAt.shape).toMatchObject({ type: 'string', format: 'date-time' });
    });

    it('caches field extraction', () => {
      const a = Order.getFields();
      const b = Order.getFields();
      expect(a).toBe(b);
    });
  });

  describe('validate()', () => {
    it('validates correct input', () => {
      const result = Customer.validate({
        id: 'abc-123',
        name: 'John',
        email: 'john@test.com',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('John');
      }
    });

    it('rejects missing required fields', () => {
      const result = Customer.validate({
        id: 'abc-123',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors.some(e => e.path === 'name')).toBe(true);
      }
    });

    it('rejects wrong types', () => {
      const result = Customer.validate({
        id: 'abc-123',
        name: 123,
        email: 'test@test.com',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.path === 'name')).toBe(true);
      }
    });

    it('validates enum values', () => {
      const valid = Order.validate({
        id: '1',
        customerId: 'c1',
        status: 'pending',
        total: 100,
      });
      expect(valid.success).toBe(true);

      const invalid = Order.validate({
        id: '1',
        customerId: 'c1',
        status: 'unknown',
        total: 100,
      });
      expect(invalid.success).toBe(false);
    });

    it('validates number constraints', () => {
      const result = Order.validate({
        id: '1',
        customerId: 'c1',
        status: 'pending',
        total: -5,
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.errors.some(e => e.path === 'total')).toBe(true);
      }
    });

    it('auto fields: absence is legal and omitted — storage stamps, not validation', () => {
      const result = Order.validate({
        id: '1',
        customerId: 'c1',
        status: 'pending',
        total: 100,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect('createdAt' in result.data).toBe(false);
      }
    });

    it('many fields default to empty array', () => {
      const result = Order.validate({
        id: '1',
        customerId: 'c1',
        status: 'pending',
        total: 100,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lines).toEqual([]);
      }
    });
  });

  describe('from()', () => {
    it('projects only known fields', () => {
      const result = Customer.from({
        id: 'abc',
        name: 'John',
        email: 'john@test.com',
        unknownField: 'should be dropped',
      });
      expect(result).toEqual({
        id: 'abc',
        name: 'John',
        email: 'john@test.com',
      });
      expect('unknownField' in result).toBe(false);
    });
  });
});
