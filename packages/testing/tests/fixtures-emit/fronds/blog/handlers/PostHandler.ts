import { Crud, type RepositoryOf, type Emit } from '@fougere/core';
import Post from '../entities/Post.js';
import PostPublished from '../entities/PostPublished.js';

export default class PostHandler extends Crud(Post) {
  constructor(repo: RepositoryOf<Post>, private published: Emit<PostPublished>) {
    super(repo);
  }

  /** Publishes a post and says so. */
  async publish(input: Post): Promise<Post> {
    const row = await this.orm.update(input.id, { status: 'published' });
    // The cast is the known hole, not a shortcut: `Emit<T>` names the ROW type, where
    // `created()` is present and required, so announcing without `at` is a compile error
    // (TS2741) although the announcement is exactly what fills it. Writing the field here
    // would hide what `emit.test.ts` proves — that `applyCreate` runs on announcement.
    await this.published({ id: row.id, title: row.title } as never);
    return row;
  }
}
