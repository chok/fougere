import { Crud, type EntityOrm, type Emit } from '@fougere/core';
import Post from '../entities/Post.js';
import PostPublished from '../entities/PostPublished.js';

export default class PostHandler extends Crud(Post) {
  constructor(orm: EntityOrm<Post>, private published: Emit<PostPublished>) { super(orm); }
}
