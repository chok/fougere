/** A collector of the frond a frond extends is in its scope: the parameter comes from it, never from the request. */
import { describe, expect, it } from 'vitest';
import { createContainer } from '@fougere/container';
import { json } from '@fougere/schema';
import { createApp, createLocalRunner, frond, Invocation } from '../src/index.js';
import { op, typed } from './contract.js';
import PostHandler from './fixtures-collector-split/fronds/blog/handlers/PostHandler.js';
import Post from './fixtures-collector-split/fronds/blog/entities/Post.js';
import User from './fixtures-collector-split/fronds/identity/entities/User.js';
import CurrentUserCollector from './fixtures-collector-split/fronds/identity/collectors/CurrentUserCollector.js';

const family = [
  frond('shared', { collectors: [CurrentUserCollector] }),
  frond('blog', {
    entities: [Post, User],
    handlers: [{ ctor: PostHandler, operations: { whoOptional: op({ params: [typed('user', 'User', { optional: true })], cardinality: 'none' }) } }],
  }),
];

const session = { name: 'session', state: { user: json(User) } };
const boot = () => createApp({ createContainer, fronds: family, under: { blog: { extends: 'shared' } }, extensions: [session] });

describe('a collector the parent frond declares', () => {
  it('hands the parameter, and ignores a user the caller sends', async () => {
    await using app = await boot();
    const call = (invocation: Invocation) => createLocalRunner(app)({ address: 'post', op: 'whoOptional' }, invocation);

    await expect(call(Invocation.from({ state: { user: { id: 'u1', email: 'ada@x.dev', role: 'reader' } } }))).resolves.toMatchObject({ id: 'u1' });
    await expect(call(Invocation.from({ input: { user: { id: 'forged', email: 'eve@x.dev', role: 'admin' } } }))).resolves.toBeNull();
  });

  it('raises no warning', async () => {
    await using app = await boot();

    expect(app.operationsFor('post')?.get('whoOptional')?.binding[0]?.source).toEqual({ kind: 'collector', typeName: 'user' });
  });
});
