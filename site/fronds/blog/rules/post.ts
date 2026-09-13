import { FougereError, ErrorCode } from '@fougere/core';
import Post from '../entities/Post.js';
import PostRepository from '../repositories/PostRepository.js';
import User from '@fronds/user/entities/User.js';

// What every operation on a post checks before it writes. They take what they judge and hold
// nothing, which makes them words of the frond rather than a service — and keeps them out of
// the handler, where only public methods become operations.

export function requireUser(user: User | undefined, operation: string): User {
  if (!user) {
    throw new FougereError({ code: ErrorCode.UNAUTHORIZED, message: 'Sign in to write', entity: 'post', operation });
  }
  return user;
}

export async function requireOwn(posts: PostRepository, id: string, author: User, operation: string): Promise<Post> {
  const post = await posts.findById(id);
  if (!post) {
    throw new FougereError({ code: ErrorCode.NOT_FOUND, message: `Post '${id}' not found`, entity: 'post', operation });
  }
  if (post.authorId !== author.id) {
    throw new FougereError({ code: ErrorCode.FORBIDDEN, message: 'Only the author can do that', entity: 'post', operation });
  }
  return post;
}

export async function requireFreeSlug(posts: PostRepository, slug: string, ownId: string | undefined, operation: string): Promise<void> {
  const clash = await posts.findBySlug(slug);
  if (clash && clash.id !== ownId) {
    throw new FougereError({ code: ErrorCode.CONFLICT, message: `Slug '${slug}' is already taken`, entity: 'post', operation });
  }
}
