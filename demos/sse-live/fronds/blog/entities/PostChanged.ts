import { created } from '@fougere/schema';
import Post from './Post.js';

/**
 * The fact. It carries what a carrier needs to ROUTE — who wrote it, whether it is
 * out — and not one field a reader would want to display.
 *
 * That is the split the demo is about: `title` is deliberately absent, so nothing
 * downstream can show a post without asking for it through the door that validates.
 */
export default class PostChanged extends Post.pick('id', 'author', 'status').extend({
  at: created(),
}) {}
