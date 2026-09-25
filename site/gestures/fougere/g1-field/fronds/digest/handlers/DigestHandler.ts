import type { Facade } from '@fougere/core';
import type PostHandler from '@fronds/blog/handlers/PostHandler.js';

export default class DigestHandler {
  constructor(private posts: Facade<PostHandler>) {}

  async listLatest() {
    const { items } = await this.posts.list();

    return items
      .filter((post) => post.publishedAt)
      .sort((a, b) => +new Date(b.publishedAt!) - +new Date(a.publishedAt!))
      .slice(0, 3);
  }
}
