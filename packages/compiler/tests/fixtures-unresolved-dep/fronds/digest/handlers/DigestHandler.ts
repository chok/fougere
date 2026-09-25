import type { Facade } from '@fougere/core';
import type PostHandler from '@fronds/blog/handlers/PostHandler.js';

export default class DigestHandler {
  constructor(private posts: Facade<PostHandler>) {}

  async listLatest() {
    return this.posts.list();
  }
}
