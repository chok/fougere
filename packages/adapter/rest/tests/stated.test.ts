/**
 * A REST URL has three levels, each derived and each said by whoever owns it: where the app mounts
 * REST (`fougere.config.ts`), the segment a frond answers under, and the route of one op (both in
 * `frond.config.ts`). The app may name an op's route only for a frond it cannot edit.
 */
import { describe, it, expect } from 'vitest';
import { Protocols } from '@fougere/core';
import { generateRoutes } from '../src/index.js';

const app = (options: { rest?: object; frond?: object; protocols?: object } = {}) => ({
  protocols: options.protocols ?? { rest: {} },
  fronds: [{
    name: 'blog',
    handlers: [{ address: 'post' }],
    presenters: [],
    ...(options.frond ? { protocols: { rest: options.frond } } : {}),
  }],
  facadeFor: () => ({ list: async () => [] }),
  operationsFor: () => new Map([['list', { kind: 'query', protocols: options.rest ? { rest: options.rest } : {} }]]),
}) as never;

const listOf = (built: never) => generateRoutes(built).find((one) => one.operationName === 'list')!;

describe('a REST url, level by level', () => {
  it('derives every level when nobody says anything', () => {
    expect(listOf(app())).toMatchObject({ method: 'GET', path: '/api/blog/posts' });
  });

  it('takes the route an op states, below the mount and the frond', () => {
    expect(listOf(app({ rest: { path: '/articles', status: 200 } })))
      .toMatchObject({ path: '/api/blog/articles', successStatus: 200 });
  });

  it('takes the segment the frond says it answers under', () => {
    expect(listOf(app({ frond: { path: '/journal' } })).path).toBe('/api/journal/posts');
  });

  it('takes where the app mounts REST', () => {
    expect(listOf(app({ protocols: { rest: { prefix: '/v1' } } })).path).toBe('/v1/blog/posts');
  });

  it('lets the app name the route of an op, over what the frond said', () => {
    const routed = app({ rest: { path: '/articles' }, protocols: { rest: { overrides: { 'post.list': { path: '/legacy' } } } } });

    expect(listOf(routed).path).toBe('/api/blog/legacy');
  });
});

describe('an override of fougere.config.ts', () => {
  const rest = Protocols.resolve('rest');
  const fronds = (path: string) => [{ name: 'blog', source: { path, package: '@fronds/blog' }, handlers: [{ address: 'post' }] }] as never;

  it('is admitted for a frond with no directory in this project — what a package brings', () => {
    expect(rest.refusals!({ overrides: { 'post.list': { path: '/me' } } }, fronds(''))).toEqual([]);
  });

  it('is refused for a frond of this project, and says where to write it', () => {
    const [refused] = rest.refusals!({ overrides: { 'post.list': { path: '/me' } } }, fronds('/app/fronds/blog'));

    expect(refused).toContain('belongs to blog, whose frond.config.ts is in this project');
    expect(refused).toContain(`/app/fronds/blog/frond.config.ts → operations: { 'post.list': { rest: {"path":"/me"} } }`);
  });

  it('is refused when it names no op, or an address nobody serves', () => {
    const refused = rest.refusals!({ overrides: { list: {}, 'page.list': {} } }, fronds(''));

    expect(refused).toEqual([
      "overrides: 'list' names no address. An op is named '<address>.<op>'.",
      "overrides: 'page.list' — no frond serves the address 'page'.",
    ]);
  });
});
