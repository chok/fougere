import { describe, expect, it } from 'vitest';
import type { Fields } from '../src/field/Field.js';
import type { ValidationResult } from '../src/result.js';
import { RowJudge } from '../src/judge/RowJudge.js';
import type { StandardSchemaV1 } from '../src/projection/standard.js';
import type { SchemaConstructor } from '../src/Schema.js';
import { entity } from '../src/entity.js';
import { primary } from '../src/vocabulary/primary.js';
import { readOnly } from '../src/vocabulary/readOnly.js';
import { text } from '../src/vocabulary/text.js';

class Post extends entity({
  id: primary(),
  title: text(),
  body: text(),
  publishedAt: readOnly(text()),
}) {}

type Verdict = { success: boolean; paths: string[] };

function rowVerdict<T>(result: ValidationResult<T>): Verdict {
  if (result.success) return { success: true, paths: [] };
  return { success: false, paths: result.errors.map((error) => error.path) };
}

function standardVerdict<T>(
  result: StandardSchemaV1.Result<T> | Promise<StandardSchemaV1.Result<T>>,
): Verdict {
  if (result instanceof Promise) throw new Error('expected synchronous validation');
  if (!result.issues) return { success: true, paths: [] };
  return {
    success: false,
    paths: result.issues.map((issue) => {
      if (!issue.path) return '.';
      return issue.path
        .map((segment) => String(typeof segment === 'object' ? segment.key : segment))
        .join('.');
    }),
  };
}

function expectJudgeParity<TFields extends Fields>(
  schema: SchemaConstructor<TFields>,
  input: unknown,
  expected: Verdict,
): void {
  const entityVerdict = rowVerdict(schema.validate(input));
  const directVerdict = rowVerdict(RowJudge.of(schema.getFields(), schema.getOpts()).validate(input));
  const standardSchemaVerdict = standardVerdict(schema['~standard'].validate(input));

  expect({ entityVerdict, directVerdict, standardSchemaVerdict }).toEqual({
    entityVerdict: expected,
    directVerdict: expected,
    standardSchemaVerdict: expected,
  });
}

describe('parity between the three row judges', () => {
  it('returns the same verdict and paths for a valid row', () => {
    expectJudgeParity(Post, { title: 'Hello', body: 'World' }, { success: true, paths: [] });
  });

  it('returns the same verdict and paths for an unknown key', () => {
    expectJudgeParity(
      Post,
      { title: 'Hello', body: 'World', extra: true },
      { success: false, paths: ['extra'] },
    );
  });

  it('returns the same verdict and paths for an absent required field', () => {
    expectJudgeParity(Post, { body: 'World' }, { success: false, paths: ['title'] });
  });

  it('returns the same verdict and paths for a supplied read-only field', () => {
    expectJudgeParity(Post, {
      title: 'Hello',
      body: 'World',
      publishedAt: '2026-08-24T00:00:00.000Z',
    }, { success: false, paths: ['publishedAt'] });
  });

  it('returns the same verdict and paths in patch mode', () => {
    expectJudgeParity(Post.partial(), { body: 'Updated' }, { success: true, paths: [] });
  });
});
