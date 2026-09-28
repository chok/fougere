import { Repository } from '@fougere/core';
import Post from '../entities/Post.js';

export class PostCard extends Post.pick('id', 'title', 'status') {}

export default class PostRepository extends Repository(Post) {
  published(): Promise<PostCard[]> {
    return this.output(PostCard).findAllBy({ status: 'published' });
  }
}
