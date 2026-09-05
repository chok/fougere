/**
 * What both hosts sit on.
 *
 * `useQuery` in Vue and `useQuery` in React are two projections of these functions,
 * and the rules they must not restate live here: what a designation resolves to,
 * when two reads share a key, which reads a command invalidates, and how a wire
 * result reads as a page. A drift here is a drift in both hosts at once, which is
 * exactly why it is worth pinning below the reactivity rather than through it.
 */
import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { FougereError, ErrorCode } from '@fougere/core/contract';
import {
  asFougereError,
  callOf,
  entityKeyOf,
  invocationOf,
  itemsOf,
  mountedKeys,
  pageOf,
  queryKeyOf,
  trackQuery,
} from '../src/client.js';

class Post extends entity({ id: primary(), title: text() }) {}
class BlogPost extends entity({ id: primary(), title: text() }) {}

describe('designation', () => {
  it('reads the registration key off the class name', () => {
    expect(entityKeyOf(Post)).toBe('post');
  });

  it('lowercases only the first letter, so two words stay two words', () => {
    expect(entityKeyOf(BlogPost)).toBe('blogPost');
  });

  it('names a call as entity + verb', () => {
    expect(callOf(Post, 'publish')).toEqual({ entity: 'post', op: 'publish' });
  });
});

describe('queryKeyOf', () => {
  it('gives one key to one designation and input — two components share a read', () => {
    expect(queryKeyOf('post', 'list', { query: { page: '1' } }))
      .toBe(queryKeyOf('post', 'list', { query: { page: '1' } }));
  });

  it('separates two ops on the same entity', () => {
    expect(queryKeyOf('post', 'list')).not.toBe(queryKeyOf('post', 'drafts'));
  });

  it('separates two inputs on the same op', () => {
    expect(queryKeyOf('post', 'list', { query: { page: '1' } }))
      .not.toBe(queryKeyOf('post', 'list', { query: { page: '2' } }));
  });

  it('treats an absent input and an empty one as the same read', () => {
    expect(queryKeyOf('post', 'list')).toBe(queryKeyOf('post', 'list', {}));
  });
});

describe('the link — which reads a command invalidates', () => {
  it('reports the keys mounted for that entity, and only those', () => {
    const untrackA = trackQuery('post', 'k:post:list');
    const untrackB = trackQuery('post', 'k:post:drafts');
    const untrackC = trackQuery('author', 'k:author:list');

    expect(mountedKeys('post').sort()).toEqual(['k:post:drafts', 'k:post:list']);
    expect(mountedKeys('author')).toEqual(['k:author:list']);

    untrackA();
    untrackB();
    untrackC();
  });

  it('forgets a read once its scope is gone — a stale key would refetch nothing', () => {
    const untrack = trackQuery('post', 'k:gone');
    untrack();
    expect(mountedKeys('post')).not.toContain('k:gone');
  });

  it('names nothing for an entity no page reads', () => {
    expect(mountedKeys('never-mounted')).toEqual([]);
  });
});

describe('reading a result', () => {
  it('takes a bare array as the items', () => {
    expect(itemsOf([{ id: 'a' }])).toEqual([{ id: 'a' }]);
  });

  it('takes the items out of an envelope — REST sends one, the envelope does not', () => {
    expect(itemsOf({ items: [{ id: 'a' }], total: 3 })).toEqual([{ id: 'a' }]);
  });

  it('reads no items from null, so a page renders empty rather than throwing', () => {
    expect(itemsOf(null)).toEqual([]);
  });

  it('reads the page facts off an envelope', () => {
    expect(pageOf({ items: [], total: 3, hasMore: true })).toMatchObject({ total: 3, hasMore: true });
  });

  it('reads no page facts off a bare array — JSON dropped them', () => {
    expect(pageOf([{ id: 'a' }]).total).toBeUndefined();
  });
});

describe('invocationOf', () => {
  it('completes a partial input to a whole invocation', () => {
    expect(invocationOf({ input: { title: 'x' } }))
      .toEqual({ params: {}, query: {}, input: { title: 'x' }, state: {} });
  });
});

describe('asFougereError', () => {
  it('hands back a domain refusal untouched — the code is the server’s answer', () => {
    const refusal = new FougereError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'title: too short',
      entity: 'post',
      operation: 'create',
    });
    expect(asFougereError(refusal, 'post', 'create')).toBe(refusal);
  });

  it('wraps a transport failure as unavailable rather than borrowing a code nobody sent', () => {
    const failure = asFougereError(new TypeError('Failed to fetch'), 'post', 'list');
    expect(failure.code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
    expect(failure.message).toBe('Failed to fetch');
    expect(failure.entity).toBe('post');
  });
});
