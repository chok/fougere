/**
 * A directory is a declaration — the reading the scan already performs on `entities/`
 * and `handlers/`, applied to where a test file sits.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { frondOf, rootOf, scopeOf } from '../src/index.js';

const fixtures = join(import.meta.dirname, 'fixtures');

describe('the frond a path sits in', () => {
  it('is the segment after `fronds`', () => {
    expect(frondOf('/p/site/fronds/blog/tests/publish.test.ts')).toBe('blog');
  });

  it('ignores how deep below `tests/` the file is — a sub-directory carries nothing', () => {
    expect(frondOf('/p/site/fronds/blog/tests/deep/nested/x.test.ts')).toBe('blog');
  });

  it('is nothing when the path names no frond', () => {
    expect(frondOf('/p/site/tests/publish.test.ts')).toBeUndefined();
  });

  it('takes the innermost one — a synced neighbour lives under a frond too', () => {
    expect(frondOf('/p/site/fronds/blog/.fougere/remotes/fronds/user/x.test.ts')).toBe('user');
  });
});

describe('the project a path belongs to', () => {
  it('is the first ancestor holding a config or a fronds directory', () => {
    expect(rootOf(join(fixtures, 'fronds/press/entities/Article.ts'))).toBe(fixtures);
  });

  it('is nothing outside any project', () => {
    expect(rootOf('/tmp/nowhere/x.test.ts')).toBeUndefined();
  });
});

describe('the scope a test file declares', () => {
  it('names the project and the frond under test', () => {
    expect(scopeOf(join(fixtures, 'fronds/press/tests/x.test.ts')))
      .toEqual({ root: fixtures, frond: 'press' });
  });

  it('names the project alone when the file sits above the fronds', () => {
    expect(scopeOf(join(fixtures, 'tests/x.test.ts'))).toEqual({ root: fixtures });
  });
});
