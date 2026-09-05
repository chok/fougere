import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { toTable, createTableSQL } from '../src/index.js';

/**
 * What an entity states for sql names an engine: one absent from it emits what the shape
 * would have given. So the same entity boots on every dialect, which is what separates
 * this from a decision — a decision belongs in `fougere.config.ts`.
 */
class Article extends entity(
  { id: primary(), title: text(), body: text() },
  { adapters: { sql: { body: { columnType: { pg: 'tsvector', mysql: 'longtext' } } } } },
) {}

const sqlFor = (dialect: 'sqlite' | 'pg' | 'mysql' | 'mssql') =>
  createTableSQL(toTable('article', Article), dialect);

describe('what an entity states for sql', () => {
  it('is honored by the engine it names', () => {
    expect(sqlFor('pg')).toContain('"body" tsvector');
    expect(sqlFor('mysql')).toContain('`body` longtext');
  });

  it('leaves an engine it does not name exactly where it was', () => {
    expect(sqlFor('sqlite')).toContain('"body" text');
    expect(sqlFor('mssql')).toContain('"body" nvarchar(max)');
  });

  it('changes nothing else about the column', () => {
    expect(sqlFor('pg')).toContain('"body" tsvector not null');
  });
});

/**
 * The format is stated in `src/adapter.schema.json` and validated where this adapter reads it,
 * which is `toTable` — at boot, after every import. Nothing above validates below a field name.
 */
describe('what the format refuses', () => {
  const stating = (adapters: unknown) => {
    class Draft extends entity({ id: primary(), body: text() }, { adapters } as never) {}

    return () => toTable('draft', Draft);
  };

  it('a key this adapter does not read', () => {
    expect(stating({ sql: { body: { columnTpye: { pg: 'tsvector' } } } })).toThrow(
      'Draft.adapters.sql.body: Property "columnTpye" does not match additional properties schema.',
    );
  });

  it('a columnType that is not keyed by engine', () => {
    expect(stating({ sql: { body: { columnType: 'tsvector' } } })).toThrow(
      'Draft.adapters.sql.body.columnType: Instance type "string" is invalid. Expected "object".',
    );
  });

  it('an engine no dialect answers to', () => {
    expect(stating({ sql: { body: { columnType: { postgre: 'tsvector' } } } })).toThrow(
      'Draft.adapters.sql.body.columnType: Property "postgre" does not match additional properties schema.',
    );
  });

  it('a column type that is not a string', () => {
    expect(stating({ sql: { body: { columnType: { pg: 3 } } } })).toThrow(
      'Draft.adapters.sql.body.columnType.pg: Instance type "number" is invalid. Expected "string".',
    );
  });

  it('says nothing about an entity that stated nothing', () => {
    class Plain extends entity({ id: primary(), body: text() }) {}

    expect(() => toTable('plain', Plain)).not.toThrow();
  });
});
