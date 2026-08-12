import type Post from '../entities/Post.js';
import type User from '../entities/User.js';

/**
 * Two signatures that differ only in the ORDER of their parameters. The binding is
 * right in both — `user` comes from the collector, `input` from the body.
 */
export default class PostHandler {
  /** Body param first. */
  async bodyFirst(input: Post, user: User | null) {
    return { title: input.title, role: user?.role ?? null };
  }

  /** Collector param first. Same two parameters, same two sources. */
  async collectorFirst(user: User | null, input: Post) {
    return { title: input.title, role: user?.role ?? null };
  }
}
