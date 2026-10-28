/**
 * `Collect<User>` and `Present<Post>` are ports: the collector or the presenter realizes one, a link
 * stands in front of it, and two of either refuse the way two realizations of any port do.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, json, primary, text } from '@fougere/schema';
import { Collect, createApp, createLocalRunner, frond, Invocation, Present, type InvocationContext } from '../src/index.js';
import { op, typed } from './contract.js';
import WhoHandler from './fixtures-collector-split/fronds/blog/handlers/PostHandler.js';
import BlogPost from './fixtures-collector-split/fronds/blog/entities/Post.js';
import User from './fixtures-collector-split/fronds/identity/entities/User.js';
import CurrentUserCollector from './fixtures-collector-split/fronds/identity/services/CurrentUserCollector.js';

class CachedUser implements Partial<Collect<User>> {
  static asked = 0;

  constructor(private inner: Collect<User>) {}

  async collect(context: InvocationContext) {
    CachedUser.asked++;

    return this.inner.collect(context);
  }
}

const session = { name: 'session', state: { user: json(User) } };
const asking = op({ params: [typed('user', 'User', { optional: true })], cardinality: 'none' });

const blogWith = (providers: object[], collectors: object[] = [{ ctor: CurrentUserCollector, collects: User }]) => [frond('blog', {
  entities: [BlogPost, User],
  providers: providers as never,
  collectors: collectors as never,
  handlers: [{ ctor: WhoHandler, operations: { whoOptional: asking } }],
})];

describe('a link in front of Collect<User>', () => {
  it('is handed each call, and reaches the collector', async () => {
    CachedUser.asked = 0;
    await using app = await createApp({
      createContainer,
      fronds: blogWith([{ ctor: CachedUser, deps: ['Collect<User>'], implements: ['Collect<User>'] }]),
      extensions: [session],
    });
    const call = createLocalRunner(app)({ address: 'post', op: 'whoOptional' }, Invocation.from({ state: { user: { id: 'u1', email: 'ada@x.dev', role: 'reader' } } }));

    await expect(call).resolves.toMatchObject({ id: 'u1' });
    expect(CachedUser.asked).toBe(1);
    expect(app.extensionPoints()).toContainEqual({ point: 'Collect<User>', by: 'type', frond: 'blog', answers: ['CachedUser', 'CurrentUserCollector'] });
  });

  it('refuses two collectors of one type, naming both', async () => {
    class OtherUser extends Collect<User> {
      async collect() { return undefined; }
    }

    await expect(createApp({
      createContainer,
      fronds: blogWith([], [{ ctor: CurrentUserCollector, collects: User }, { ctor: OtherUser, collects: User }]),
      extensions: [session],
    })).rejects.toThrow(/\[port-implemented-twice\][\s\S]*CurrentUserCollector and OtherUser both extend Collect<User>/);
  });
});

class Post extends entity({ id: primary(), title: text() }) {}

class Shouting extends Present<Post> {
  async shout(rows: { title: string }[]) { return rows.map((row) => row.title.toUpperCase()); }
}

class Counting implements Partial<Present<Post>> {
  constructor(private inner: Present<Post>) {}
  async length(rows: { title: string }[]) { return rows.map((row) => row.title.length); }
}

class Whispering implements Partial<Present<Post>> {
  constructor(private inner: Present<Post>) {}
  async shout(rows: { title: string }[]) { return rows.map((row) => row.title.toLowerCase()); }
}

class PostHandler {
  async list() { return [{ id: 'p1', title: 'Fern' }]; }
}

const shelf = (link: Function) => [frond('blog', {
  entities: [Post],
  providers: [{ ctor: link as never, deps: ['Present<Post>'], implements: ['Present<Post>'] }],
  presenters: [{ ctor: Shouting, presents: Post }],
  handlers: [{ ctor: PostHandler, operations: { list: op({ cardinality: 'many', output: Post }) } }],
})];

describe('a link in front of Present<Post>', () => {
  it('adds its fields to the presenter it stands in front of', async () => {
    await using app = await createApp({ createContainer, storageFactory: () => ({}) as never, fronds: shelf(Counting) });

    await expect(createLocalRunner(app)({ address: 'post', op: 'list' }, Invocation.empty))
      .resolves.toEqual([{ id: 'p1', title: 'Fern', shout: 'FERN', length: 4 }]);
  });

  it('refuses a field two classes of the chain compute, naming both', async () => {
    await expect(createApp({ createContainer, storageFactory: () => ({}) as never, fronds: shelf(Whispering) }))
      .rejects.toThrow(/\[presenter-field-twice\] Present<Post>\.shout[\s\S]*Shouting and Whispering both compute shout/);
  });
});
