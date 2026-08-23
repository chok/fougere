import type Post from '../entities/Post.js';

export default class PostHandler {
  async publish(input: Post) {
    return { ...input, handledBy: 'source' };
  }
}
