import { describe, it, expect } from 'vitest';
import { JsonSchemaValidator, type JsonSchema } from '../src/index.js';

const format: JsonSchema = {
  type: 'object',
  properties: {
    columnType: { type: 'object', properties: { pg: { type: 'string' } }, additionalProperties: false },
  },
  additionalProperties: false,
};

const validator = JsonSchemaValidator.of(format);

describe('JsonSchemaValidator', () => {
  it('accepts what the schema admits', () => {
    expect(validator.refusalOf({ columnType: { pg: 'tsvector' } }, ['body'])).toBeUndefined();
  });

  it('compiles a schema once, whoever asks for it', () => {
    expect(JsonSchemaValidator.of(format)).toBe(validator);
  });

  it('names the key the schema does not admit, not the boolean schema under it', () => {
    expect(validator.refusalOf({ columnTpye: {} }, ['body'])).toEqual({
      path: ['body'],
      message: 'Property "columnTpye" does not match additional properties schema.',
    });
  });

  it('names the path all the way down to the value that failed', () => {
    expect(validator.refusalOf({ columnType: { pg: 3 } }, ['body'])).toEqual({
      path: ['body', 'columnType', 'pg'],
      message: 'Instance type "number" is invalid. Expected "string".',
    });
  });

  it('reads a key set to undefined as a key not stated', () => {
    expect(validator.refusalOf({ columnType: undefined }, ['body'])).toBeUndefined();
  });

  it('refuses a value JSON cannot hold, rather than throwing past the caller', () => {
    expect(validator.refusalOf({ columnType: () => 'tsvector' }, ['body'])).toEqual({
      path: ['body'],
      message: 'Instances of "function" type are not supported.',
    });
  });
});
