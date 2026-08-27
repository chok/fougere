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
