import { describe, it, expect } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { createLocalRunner, Repository, frond, Invocation, type App } from '@fougere/core';
import { configureFougere, reloadFougere, useFougereApp } from '../src/boot.js';

class Post extends entity({ id: primary(), title: text() }) {}
class User extends entity({ id: primary(), name: text() }) {}
class PostHandler extends Repository<Post> {}
class UserHandler extends Repository<User> {}

const blog = () => frond('blog', { entities: [Post], handlers: [{ ctor: PostHandler, repository: Post }] });
const people = () => frond('people', { entities: [User], handlers: [{ ctor: UserHandler, repository: User }] });
const listPosts = (app: App) => createLocalRunner(app)({ address: 'post', op: 'list' }, Invocation.empty);

describe('a reload after a reconfiguration', () => {
  it('serves the new fronds and releases the app the configuration replaced', async () => {
    configureFougere({ fronds: [blog()] });
    const before = await useFougereApp();

    configureFougere({ fronds: [blog(), people()] });
    const after = await reloadFougere();

    expect(after.fronds.servedNames()).toEqual(['post', 'user']);
    await expect(listPosts(before)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    await expect(listPosts(after)).resolves.toMatchObject({ items: [] });
  });

  it('releases every app replaced since the last reload, not only the last one', async () => {
    configureFougere({ fronds: [blog()] });
    const first = await useFougereApp();
    configureFougere({ fronds: [blog()] });
    const second = await useFougereApp();

    configureFougere({ fronds: [blog(), people()] });
    await reloadFougere();

    await expect(listPosts(first)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    await expect(listPosts(second)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('keeps serving from the old app when the new one refuses to boot, and releases it at the next reload', async () => {
    configureFougere({ fronds: [blog()] });
    const before = await useFougereApp();

    configureFougere({ fronds: [blog(), frond('broken', { handlers: [{ ctor: class BrokenHandler {}, deps: ['Missing'] }] })] });
    await expect(reloadFougere()).rejects.toThrow();
    await expect(listPosts(before)).resolves.toMatchObject({ items: [] });

    configureFougere({ fronds: [blog()] });
    await reloadFougere();
    await expect(listPosts(before)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });
});
