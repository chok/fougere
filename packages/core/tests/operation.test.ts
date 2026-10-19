import { describe, expect, it } from 'vitest';
import { inferOperationKind } from '../src/wire/OperationContract.js';

describe('the kind a name tells', () => {
  it('is a query when every verb of the name reads', () => {
    for (const name of ['list', 'listPosts', 'get', 'getPost', 'findById', 'searchPosts', 'countPosts', 'existsPost', 'statsFor', 'canPublish', 'isAvailable', 'getOrFetch']) {
      expect(inferOperationKind(name), name).toBe('query');
    }
  });

  it('is a command otherwise — a write verb, a word it does not know, or a write after a read', () => {
    for (const name of ['create', 'update', 'archivePost', 'republishPost', 'settle', 'computeReport', 'hashPassword', 'cancelOrder', 'issueRefund', 'findAndArchive', 'getOrCreatePost']) {
      expect(inferOperationKind(name), name).toBe('command');
    }
  });

  it('matches whole words, never string prefixes', () => {
    expect(inferOperationKind('hashPassword')).toBe('command');
    expect(inferOperationKind('isbnLookup')).toBe('command');
  });
});
