import type Post from '../entities/Post.js';
import type User from '../entities/User.js';

export default class PostHandler {
  /** Publish a post for the current user. */
  async publish(input: Post, user?: User): Promise<Post> {
    return { ...input, title: user ? input.title : input.title } as Post;
  }
}
