import { describe, it, expect } from 'vitest';
import { EntryJudge } from '../src/judge/EntryJudge.js';
import type { Shape } from '../src/axis/shape/Shape.js';

/**
 * The mechanism alone: an adapter states the format, `schema` judges against it and learns
 * nothing about what is inside. The format below stands in for one an adapter would ship.
 */
const format: Shape = {
  type: 'object',
  properties: {
    columnType: { type: 'object', properties: { pg: { type: 'string' } }, additionalProperties: false },
  },
  additionalProperties: false,
};

const judge = EntryJudge.of(format);
const check = (entries: unknown) => () => judge.assert(entries, 'Post.adapters.sql');

describe('EntryJudge', () => {
  it('accepts what the format admits', () => {
    expect(check({ body: { columnType: { pg: 'tsvector' } } })).not.toThrow();
  });

  it('accepts an adapter that was given nothing', () => {
    expect(check(undefined)).not.toThrow();
  });

  it('refuses entries that are not addressed by field name', () => {
    expect(check('oops')).toThrow(
      'Post.adapters.sql: expected an object keyed by field name, got string.',
    );
  });

  it('names the field and the key the format does not admit', () => {
    expect(check({ body: { columnTpye: {} } })).toThrow(
      'Post.adapters.sql.body: Property "columnTpye" does not match additional properties schema.',
    );
  });

  it('names the path all the way down to the value that failed', () => {
    expect(check({ body: { columnType: { pg: 3 } } })).toThrow(
      'Post.adapters.sql.body.columnType.pg: Instance type "number" is invalid. Expected "string".',
    );
  });

  it('refuses on the first field that fails, whichever it is', () => {
    expect(check({ title: { columnType: { pg: 'text' } }, body: { nope: 1 } })).toThrow(
      'Post.adapters.sql.body',
    );
  });
});
