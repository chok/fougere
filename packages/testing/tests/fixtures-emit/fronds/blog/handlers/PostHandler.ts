import { Crud, type RepositoryOf, type Emit } from '@fougere/core';
import Post from '../entities/Post.js';
import PostPublished from '../entities/PostPublished.js';

export default class PostHandler extends Crud(Post) {
  constructor(repo: RepositoryOf<Post>, private published: Emit<PostPublished>) {
    super(repo);
  }

  /** Publishes a post and says so. */
  async publish(input: Post): Promise<Post> {
    const row = await this.storage.update(input.id, { status: 'published' });
    // No `at`: the announcement fills it, which is what `emit.test.ts` proves.
    await this.published({ id: row.id, title: row.title });
    return row;
  }
}
