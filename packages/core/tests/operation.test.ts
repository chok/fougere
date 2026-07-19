import { describe, it, expect } from 'vitest';
import { isReadOp, resolveIsReadOp } from '../src/operation.js';

describe('isReadOp (convention)', () => {
  it('recognizes default read prefixes', () => {
    expect(isReadOp('list')).toBe(true);
    expect(isReadOp('listPosts')).toBe(true);
    expect(isReadOp('get')).toBe(true);
    expect(isReadOp('getPost')).toBe(true);
    expect(isReadOp('findById')).toBe(true);
    expect(isReadOp('searchPosts')).toBe(true);
    expect(isReadOp('countPosts')).toBe(true);
    expect(isReadOp('existsPost')).toBe(true);
    expect(isReadOp('statsFor')).toBe(true);
  });

  it('classifies non-read prefixes as write', () => {
    expect(isReadOp('create')).toBe(false);
    expect(isReadOp('update')).toBe(false);
    expect(isReadOp('archivePost')).toBe(false);
    expect(isReadOp('republishPost')).toBe(false);
    expect(isReadOp('computeReport')).toBe(false);
  });
});

describe('resolveIsReadOp (convention + overrides)', () => {
  it('falls back to convention when no override is present', () => {
    expect(resolveIsReadOp('listPosts')).toBe(true);
    expect(resolveIsReadOp('createPost')).toBe(false);
    expect(resolveIsReadOp('listPosts', {})).toBe(true);
    expect(resolveIsReadOp('createPost', {})).toBe(false);
  });

  it('overrides convention: a non-read-prefixed name can be declared as query', () => {
    expect(resolveIsReadOp('computeReport')).toBe(false);
    expect(resolveIsReadOp('computeReport', { computeReport: { kind: 'query' } })).toBe(true);
  });

  it('overrides convention: a read-prefixed name can be declared as command', () => {
    expect(resolveIsReadOp('findAndArchive')).toBe(true);
    expect(resolveIsReadOp('findAndArchive', { findAndArchive: { kind: 'command' } })).toBe(false);
  });

  it('ignores overrides that don\'t match the op name', () => {
    expect(resolveIsReadOp('listPosts', { createPost: { kind: 'query' } })).toBe(true);
    expect(resolveIsReadOp('createPost', { listPosts: { kind: 'command' } })).toBe(false);
  });

  it('handles override with kind undefined (no-op)', () => {
    expect(resolveIsReadOp('listPosts', { listPosts: {} })).toBe(true);
    expect(resolveIsReadOp('createPost', { createPost: {} })).toBe(false);
  });
});
