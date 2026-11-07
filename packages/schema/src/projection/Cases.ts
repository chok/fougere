import { Shapes } from '../axis/shape/Shape.js';
import { Boundary } from '../axis/boundary/Boundary.js';
import { Lifecycle } from '../axis/lifecycle/Lifecycle.js';
import { Role } from '../axis/role/Role.js';
import type { Field } from '../field/Field.js';
import type { SchemaView } from '../SchemaView.js';
import { InputValidator } from '../validator/InputValidator.js';
import { InputRefusal } from '../validator/InputRefusal.js';
import type { ValidationCase } from './ValidationCase.js';

function wrongTypeFor(field: Field): unknown {
  const declared = (field.shape as { type?: string | readonly string[] }).type;
  const names = Array.isArray(declared) ? declared : [declared];

  return names.includes('string') ? 42 : 'not-a-value-of-this-shape';
}

function outOfBoundsFor(field: Field): { why: string; value: unknown }[] {
  const shape = Shapes.of(field.shape).base;
  const cases: { why: string; value: unknown }[] = [];
  if (shape?.type === 'string') {
    if (typeof shape.minLength === 'number' && shape.minLength > 0)
      cases.push({ why: 'shorter than min', value: 'x'.repeat(shape.minLength - 1) });
    if (typeof shape.maxLength === 'number')
      cases.push({ why: 'longer than max', value: 'x'.repeat(shape.maxLength + 1) });
    if (shape.enum) cases.push({ why: 'outside the stated set', value: '__not-in-enum__' });
  }
  if (shape?.type === 'number' || shape?.type === 'integer') {
    if (typeof shape.minimum === 'number')
      cases.push({ why: 'below minimum', value: shape.minimum - 1 });
    if (typeof shape.maximum === 'number')
      cases.push({ why: 'above maximum', value: shape.maximum + 1 });
    if (typeof shape.exclusiveMinimum === 'number')
      cases.push({ why: 'at the exclusive minimum', value: shape.exclusiveMinimum });
    if (typeof shape.exclusiveMaximum === 'number')
      cases.push({ why: 'at the exclusive maximum', value: shape.exclusiveMaximum });
    if (shape.enum) {
      const members = shape.enum.filter((value) => typeof value === 'number');

      cases.push({ why: 'outside the stated set', value: Math.max(...members) + 1 });
    }
  }
  if (shape?.type === 'array') {
    if (typeof shape.minItems === 'number' && shape.minItems > 0)
      cases.push({ why: 'fewer items than min', value: [] });
    if (typeof shape.maxItems === 'number')
      cases.push({
        why: 'more items than max',
        value: Array.from({ length: shape.maxItems + 1 }, () => null),
      });
  }

  return cases;
}

/** The validation cases an entity's fields imply, from a valid row of the complete entity. */
export class Cases {
  private constructor(readonly all: readonly ValidationCase[]) {}

  static of(schema: SchemaView, valid: Record<string, unknown>): Cases {
    return new Cases(enumerate(schema, valid));
  }

  static holds(
    expected: ValidationCase['expect'],
    result: { success: boolean; errors?: { path: readonly string[] }[] },
  ): boolean {
    if (expected === 'accept') return result.success;
    if (result.success) return false;

    return (result.errors ?? []).some((error) => rejected(error.path) === expected.reject);
  }

  static get refusals(): string[] {
    return Object.values(InputRefusal);
  }

  [Symbol.iterator](): Iterator<ValidationCase> {
    return this.all[Symbol.iterator]();
  }
}

function enumerate(schema: SchemaView, valid: Record<string, unknown>): ValidationCase[] {
  const fields = schema.getFields();
  const validator = InputValidator.of(fields);

  return [
    ...aboutTheInput(valid),
    ...Object.entries(fields).flatMap(([name, field]) => aboutField(name, field as Field, valid, validator)),
  ];
}

function aboutTheInput(valid: Record<string, unknown>): ValidationCase[] {
  return [
    { why: 'a valid input', input: valid, patch: false, expect: 'accept' },
    {
      why: 'a key outside the contract',
      input: { ...valid, __unknown__: 'x' },
      patch: false,
      expect: { reject: '__unknown__' },
    },
    { why: 'not an object at all', input: 'a string', patch: false, expect: { reject: '.' } },
  ];
}

function aboutField(
  name: string,
  field: Field,
  valid: Record<string, unknown>,
  validator: InputValidator,
): ValidationCase[] {
  const withField = (value: unknown) => ({ ...valid, [name]: value });
  const cases: ValidationCase[] = [];

  if (validator.requires(field) && name in valid) {
    const input = { ...valid };
    delete input[name];
    cases.push({ why: `${name} absent`, input, patch: false, expect: { reject: name } });
  }

  if (Boundary.of(field).readOnly()) {
    cases.push({
      why: `${name} supplied although read-only`,
      input: withField(wrongTypeFor(field)),
      patch: false,
      expect: { reject: name },
    });
  }

  if (Role.of(field).isCollection()) {
    cases.push({
      why: `${name} supplied although the other side carries it`,
      input: withField([]),
      patch: false,
      expect: { reject: name },
    });
  }

  if (Lifecycle.of(field).immutable() && !Role.of(field).isPrimary()) {
    cases.push({
      why: `${name} supplied on an update`,
      input: { [name]: valid[name] ?? wrongTypeFor(field) },
      patch: true,
      expect: { reject: name },
    });
  }

  if (name in valid && !Role.of(field).isReference()) {
    cases.push({
      why: `${name} of the wrong type`,
      input: withField(wrongTypeFor(field)),
      patch: false,
      expect: { reject: name },
    });
    for (const { why, value } of outOfBoundsFor(field)) {
      cases.push({ why: `${name} ${why}`, input: withField(value), patch: false, expect: { reject: name } });
    }
  }

  return cases;
}

const rejected = (path: readonly string[]): string => path[0] ?? '.';
