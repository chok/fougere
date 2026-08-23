import type Post from '../entities/Post.js';

export default class ArchiveHandler {
  async execute(input: Post) {
    return { ...input, handledBy: 'delegate' };
  }
}
