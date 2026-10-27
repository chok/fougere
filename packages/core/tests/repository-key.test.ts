/**
 * A service extending `Repository<Post>` IS the post repository: whoever asks for `Repository<Post>`
 * is handed it, whatever its name, and it still answers its own — where TypeScript sees its queries.
 */
import { describe, it, expect } from 'vitest';
import { createContainer, type Container } from '@fougere/container';
import { entity, primary, text } from '@fougere/schema';
import { createApp, frond, Repository } from '../src/index.js';
import { memory } from './memory.js';

class Post extends entity({ id: primary(), title: text() }) {}

class PostQueries extends Repository<Post> {
  async titled(title: string) { return this.findBy({ title }); }
}
class Drafts extends Repository<Post> {}

class Digest {
  constructor(readonly posts: Repository<Post>, readonly queries: PostQueries) {}
}

const boot = (extra: unknown[] = []) => createApp({
  createContainer,
  storageFactory: memory,
  migrates: true,
  fronds: [frond('blog', {
    entities: [Post],
    providers: [{ ctor: PostQueries, repository: Post }, ...extra as never[], { ctor: Digest, deps: ['PostRepository', 'PostQueries'] }],
  })],
} as never);

describe('a service extending Repository<Post>', () => {
  it('answers Repository<Post> and its own name, the default stepping aside', async () => {
    await using app = await boot();
    const blog = app.resolve<Container>('frond:blog');
    const digest = blog.resolve<Digest>('Digest');

    expect(digest.posts).toBeInstanceOf(PostQueries);
    expect(digest.queries).toBeInstanceOf(PostQueries);
    await digest.queries.create({ id: 'p1', title: 'fern' });
    expect(await digest.queries.titled('fern')).toMatchObject({ id: 'p1' });
  });

  it('refuses two, naming both', async () => {
    await expect(boot([{ ctor: Drafts, repository: Post }])).rejects.toThrow(/PostQueries and Drafts both extend/);
  });
});
