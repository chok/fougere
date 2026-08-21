import { created } from '@fougere/schema';
import Post from './Post.js';

/** A fact IS an entity: it has a shape, so it meets the same judge on both ends. */
export default class PostPublished extends Post.pick('id', 'title').extend({
  at: created(),
}) {}
