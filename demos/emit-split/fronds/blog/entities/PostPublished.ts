import { created } from '@fougere/schema';
import Post from './Post.js';

/**
 * A fact is an entity, and usually a derivation of the one it is about.
 *
 * `pick` keeps its source, so a constraint that moves on `Post` moves here without anyone
 * touching this file. Nothing marks it as a fact: it becomes one because somebody writes
 * `Emit<PostPublished>` — or `Fact<PostPublished>` — about it.
 */
export default class PostPublished extends Post.pick('id', 'title').extend({ at: created() }) {}
