import { Crud, FougereError, ErrorCode } from '@fougere/core';
import Post from '../entities/Post.js';
import PostRepository, { type PostCard } from '../repositories/PostRepository.js';

export default class PostHandler extends Crud(Post) {
  constructor(private posts: PostRepository) {
    super(posts);
  }

  /** The draft→published transition. */
  async publish(id: string): Promise<Post> {
    const post = await super.findById(id);
    if (!post) {
      throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found` });
    }
    if (post.status === 'published') {
      throw new FougereError({ code: ErrorCode.CONFLICT, message: 'Already published' });
    }

    return super.update(id, { status: 'published' });
  }

  /** Only published posts, projected to the card. */
  async listPublished(): Promise<PostCard[]> {
    return this.posts.published();
  }
}
