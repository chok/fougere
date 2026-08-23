import { describe, it, expect } from 'vitest';
import {
  inferOperationKind,
  isReadOp,
  resolveIsReadOp,
} from '../src/wire/operation.js';

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

  it('recognizes finite command verbs', () => {
    expect(isReadOp('create')).toBe(false);
    expect(isReadOp('update')).toBe(false);
    expect(isReadOp('archivePost')).toBe(false);
    expect(isReadOp('republishPost')).toBe(false);
    expect(isReadOp('settle')).toBe(false);
  });

  it('refuses a name with zero evidence instead of silently calling it a command', () => {
    expect(inferOperationKind('computeReport')).toEqual({
      kind: undefined,
      queryMatches: [],
      commandMatches: [],
    });
    expect(() => isReadOp('computeReport')).toThrow(/Cannot infer operation kind/);
  });

  it('refuses contradictory compound evidence', () => {
    expect(inferOperationKind('findAndArchive')).toMatchObject({
      kind: undefined,
      queryMatches: ['find'],
      commandMatches: ['archive'],
    });
    expect(() => isReadOp('getOrCreatePost')).toThrow(/Cannot infer operation kind/);
  });

  it('matches whole words, never string prefixes', () => {
    expect(() => isReadOp('hashPassword')).toThrow(/Cannot infer operation kind/);
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
    expect(() => resolveIsReadOp('computeReport')).toThrow(/Cannot infer operation kind/);
    expect(resolveIsReadOp('computeReport', { computeReport: { kind: 'query' } })).toBe(true);
  });

  it('overrides convention: a read-prefixed name can be declared as command', () => {
    expect(() => resolveIsReadOp('findAndArchive')).toThrow(/Cannot infer operation kind/);
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
