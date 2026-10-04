import { Crud, FougereError, ErrorCode } from '@fougere/core';
import Post from '../entities/Post.js';
import type PostCard from '../entities/PostCard.js';
import PostRepository from '../repositories/PostRepository.js';

export default class PostHandler extends Crud(Post) {
  constructor(private posts: PostRepository) {
    super(posts);
  }

  /** The draft→published transition. */
  async publish(id: Post['id']): Promise<Post> {
    const post = await this.posts.findById(id);
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found` });
    }
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published' });
    }

    return this.posts.update(id, { status: 'published' });
  }

  /** Only published posts, projected to the card. */
  async listPublished(): Promise<PostCard[]> {
    return this.posts.published();
  }
}
