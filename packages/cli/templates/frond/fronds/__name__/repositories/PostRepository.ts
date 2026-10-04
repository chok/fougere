import { Repository } from '@fougere/core';
import Post from '../entities/Post.js';
import PostCard from '../entities/PostCard.js';

export default class PostRepository extends Repository(Post) {
  published(): Promise<PostCard[]> {
    return this.output(PostCard).findAllBy({ status: 'published' });
  }
}
