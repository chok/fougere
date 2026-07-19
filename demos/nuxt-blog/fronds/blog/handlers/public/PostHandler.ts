import { Crud } from '@fougere/core';
import Post from '../../entities/Post.js';

/** Public output — summary only, no body. */
export class PostPublic extends Post.pick('id', 'title', 'authorId', 'createdAt') {}

export default class PostHandler extends Crud(Post, PostPublic) {}
