/**
 * A statement that no longer matches the method it is about.
 *
 * `frond.config.ts` wins over the scan by design — it is the only answer for an op
 * inherited from an installed base class the workspace scan cannot see. The cost of that
 * order is that it wins SILENTLY: rename `publish(id)` to `publish(postId)` and the stated
 * binding keeps applying, the parameter receives nothing, and no test fails because
 * nothing is wrong with either half on its own.
 */
import { describe, it, expect } from 'vitest';
import { statementDrift } from '../src/boot/statement-drift.js';
import type { FrondDescriptor, HandlerEntry } from '../src/descriptor/frond.js';

class PostHandler { publish() { /* stands in for the real one */ } }

const handlerWith = (params: string[]): HandlerEntry => ({
  name: 'PostHandler', address: 'post', entityName: 'post', ctor: PostHandler,
  filePath: '/blog/PostHandler.ts', deps: [], exposed: true,
  operations: new Map([['publish', {
    signature: {
      name: 'publish',
      params: params.map((name) => ({ name, type: { raw: 'string', name: 'string' }, optional: false })),
    },
  }]]),
} as unknown as HandlerEntry);

const frondStating = (bound: string[]): FrondDescriptor => ({
  name: 'blog', source: { path: '', package: '@fronds/blog' },
  providers: [], entities: [], handlers: [], presenters: [], collectors: [], seeds: [],
  operationsOverrides: {
    publish: { binding: bound.map((name) => ({ name, source: { kind: 'param' as const, name }, optional: false })) },
  },
} as unknown as FrondDescriptor);

describe('a stated binding, against the signature it is about', () => {
  it('says nothing while the two agree', () => {
    expect(statementDrift(frondStating(['id']), handlerWith(['id']))).toEqual([]);
  });

  it('names the parameter the method no longer declares', () => {
    const [found, ...rest] = statementDrift(frondStating(['id']), handlerWith(['postId']));

    expect(rest, 'one finding per operation, not per parameter').toHaveLength(0);
    expect(found).toMatchObject({
      severity: 'warning',
      code: 'stated-binding-drifted',
      subject: 'PostHandler.publish',
    });
    // The message carries both halves: what was stated, and what is declared now.
    expect(found!.message).toContain('`id`');
    expect(found!.message).toContain('(postId)');
  });

  it('warns rather than refuses — the statement is still the author\'s word', () => {
    const [found] = statementDrift(frondStating(['id']), handlerWith(['postId']));

    // A boot that ran yesterday must not stop running because a parameter moved. What it
    // must not do is stay quiet.
    expect(found!.severity).toBe('warning');
  });

  it('leaves alone a statement about a signature nothing read', () => {
    // An op inherited from an INSTALLED base class: the workspace scan sees no signature,
    // and stating its contract is exactly what config exists for. Not drift.
    const unread = { ...handlerWith(['id']), operations: new Map() } as unknown as HandlerEntry;

    expect(statementDrift(frondStating(['id']), unread)).toEqual([]);
  });

  it('leaves alone a statement that binds nothing', () => {
    const noBinding = {
      ...frondStating([]),
      operationsOverrides: { publish: { description: 'just a sentence' } },
    } as unknown as FrondDescriptor;

    expect(statementDrift(noBinding, handlerWith(['id']))).toEqual([]);
  });
});
