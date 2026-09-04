import { entity, number, text } from '@fougere/schema';
import { describe, expect, it } from 'vitest';
import { Invocation } from '../src/wire/Invocation.js';
import { validateInput } from '../src/dispatch/validateInput.js';

class Product extends entity({ name: text(), price: number({ min: 0 }) }) {}

describe('validateInput', () => {

  it('returns a decoded invocation for a valid body', () => {
    const invocation = Invocation.from({ body: { name: 'Fern', price: 12 } });

    const validated = validateInput(Product, invocation, 'product', 'create');

    expect(validated).not.toBe(invocation);
    expect(validated.body).toEqual({ name: 'Fern', price: 12 });
    expect(validated.params).toBe(invocation.params);
  });

  it('returns the original invocation when no input schema applies', () => {
    const invocation = Invocation.from({ body: { anything: true } });

    expect(validateInput(undefined, invocation, 'health', 'check')).toBe(invocation);
  });

  it('returns a typed refusal with the operation identity', () => {
    const invocation = Invocation.from({ body: { name: 'Fern', price: -1 } });

    expect(() => validateInput(Product, invocation, 'product', 'create'))
      .toThrow(expect.objectContaining({
        code: 'VALIDATION_FAILED',
        entity: 'product',
        operation: 'create',
      }));
  });
});
