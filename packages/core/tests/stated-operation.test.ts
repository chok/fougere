/**
 * An operation written by hand states what TypeScript erases of its method — its parameters and
 * what it answers — and nothing is guessed: the boot derives the binding, the route and the card
 * from it, as it does from what the scan read.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, primary, text } from '@fougere/schema';
import { Collect, Repository, createApp, createAppRunner, frond, identityCardOf, Invocation } from '../src/index.js';
import { memory } from './memory.js';

class Post extends entity({ id: primary(), title: text(), status: text() }) {}
class User extends entity({ id: primary(), name: text() }) {}

class CurrentUserCollector extends Collect<User> {
  async collect() { return { id: 'u1', name: 'Ada' }; }
}

class PostHandler extends Repository<Post> {
  async publish(id: string, user?: { name: string }) {
    const post = await super.findById(id);

    return { ...post!, status: `published by ${user?.name}` };
  }

  async searchByTitle(input: { title: string }) {
    return [{ id: 'p1', title: input.title }];
  }
}

const blog = () => frond('blog', {
  entities: [Post, User],
  collectors: [{ ctor: CurrentUserCollector, collects: User }],
  handlers: [{
    ctor: PostHandler,
    repository: Post,
    operations: {
      publish: { params: { id: [Post, 'id'], user: { type: User, optional: true } }, output: Post },
      searchByTitle: { params: { input: Post.pick('title') }, input: Post.pick('title'), output: [Post.pick('id', 'title')] },
    },
  }],
});

describe('an operation written by hand', () => {
  it('binds its parameters from what it states — a designated row, a collected user', async () => {
    await using app = await createApp({ createContainer, storageFactory: memory, fronds: [blog()] });
    const run = createAppRunner(app);
    const created = await run({ address: 'post', op: 'create' }, Invocation.from({ input: { title: 'Fern', status: 'draft' } })) as { id: string };

    await expect(run({ address: 'post', op: 'publish' }, Invocation.from({ params: { id: created.id } })))
      .resolves.toMatchObject({ title: 'Fern', status: 'published by Ada' });
  });

  it('judges the input it states, and answers several', async () => {
    await using app = await createApp({ createContainer, storageFactory: memory, fronds: [blog()] });
    const run = createAppRunner(app);

    await expect(run({ address: 'post', op: 'searchByTitle' }, Invocation.from({ input: { title: 'Moss' } })))
      .resolves.toEqual([{ id: 'p1', title: 'Moss' }]);
    await expect(run({ address: 'post', op: 'searchByTitle' }, Invocation.from({ input: { nope: 1 } })))
      .rejects.toThrow();
  });

  it('is on the card with the kind its verb tells', async () => {
    await using app = await createApp({ createContainer, storageFactory: memory, fronds: [blog()] });
    const ops = identityCardOf(app).fronds[0]!.facades[0]!.ops;

    expect(ops.find((one) => one.name === 'publish')).toMatchObject({ kind: 'command', cardinality: 'one' });
    expect(ops.find((one) => one.name === 'searchByTitle')).toMatchObject({ kind: 'query', cardinality: 'many' });
  });
});
