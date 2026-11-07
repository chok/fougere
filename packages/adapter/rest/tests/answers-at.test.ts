/**
 * Where an op answers on REST is read the same way by the route that serves it and by whoever asks
 * the protocol without booting — `fougere explain` lists the second.
 */
import { describe, it, expect } from 'vitest';
import { Protocols, type EffectiveOperation, type FrondDescriptor } from '@fougere/core';
import { entity, primary, text } from '@fougere/schema';
import { generateRoutes } from '../src/index.js';

class Post extends entity({ id: primary(), title: text() }) {}

const designating = { name: 'id', source: { kind: 'param', name: 'id', identifies: 'Post' }, optional: false };

const operations = new Map<string, Record<string, unknown>>([
  ['list', { kind: 'query', binding: [] }],
  ['update', { kind: 'command', binding: [designating, { name: 'input', source: { kind: 'input' }, optional: false }], input: Post.partial() }],
  ['delete', { kind: 'command', binding: [designating] }],
  ['publish', { kind: 'command', binding: [designating] }],
  ['archive', { kind: 'command', binding: [designating], protocols: { rest: { method: 'PUT', path: '/posts/:id/archived' } } }],
  ['onPublished', { kind: 'command', binding: [{ name: 'fact', source: { kind: 'fact', factName: 'postPublished' }, optional: false }] }],
]);

const options = { prefix: '/v1' };
const frond = { name: 'blog', handlers: [{ address: 'post' }], presenters: [], protocols: { rest: { path: '/journal' } } };
const facade = Object.fromEntries([...operations.keys()].map((name) => [name, async () => undefined]));

const app = {
  protocols: { rest: options },
  fronds: [frond],
  facadeFor: () => facade,
  operationsFor: () => operations as never,
};

function answersAt(name: string): string | undefined {
  const operation = { ...operations.get(name), name, handler: { address: 'post' } } as unknown as EffectiveOperation;

  return Protocols.resolve('rest').answersAt!(operation, options, frond as unknown as FrondDescriptor);
}

describe('REST answersAt', () => {
  it('answers what the served route answers, op by op', () => {
    const served = generateRoutes(app).map((route) => [route.operationName, `${route.method} ${route.path}`]);

    expect(served.length).toBeGreaterThan(0);
    for (const [name, route] of served) expect(answersAt(name!)).toBe(route);
  });

  it('reads the prefix, the frond segment and what the frond stated', () => {
    expect(answersAt('update')).toBe('PATCH /v1/journal/posts/:id');
    expect(answersAt('publish')).toBe('POST /v1/journal/posts/:id/publish');
    expect(answersAt('archive')).toBe('PUT /v1/journal/posts/:id/archived');
  });

  it('answers nothing for an op a fact calls', () => {
    expect(answersAt('onPublished')).toBeUndefined();
  });
});
