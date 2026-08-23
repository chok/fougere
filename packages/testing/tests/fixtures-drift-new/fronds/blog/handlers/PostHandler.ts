import { Crud, type RepositoryOf, type Emit } from '@fougere/core';
import Post from '../entities/Post.js';
import PostPublished from '../entities/PostPublished.js';

export default class PostHandler extends Crud(Post) {
  constructor(repo: RepositoryOf<Post>, private published: Emit<PostPublished>) { super(repo); }
}
