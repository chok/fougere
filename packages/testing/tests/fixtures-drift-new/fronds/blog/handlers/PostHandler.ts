import { Crud, type Repository, type Emit } from '@fougere/core';
import Post from '../entities/Post.js';
import PostPublished from '../entities/PostPublished.js';

export default class PostHandler extends Crud(Post) {
  constructor(repo: Repository<Post>, private published: Emit<PostPublished>) { super(repo); }
}
