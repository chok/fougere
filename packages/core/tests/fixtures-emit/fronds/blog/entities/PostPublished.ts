import { auto } from '@fougere/schema';
import Post from './Post.js';

/**
 * A fact is an entity, and usually a derivation of the one it is about.
 *
 * `pick` keeps its source (`entity.ts`), so a constraint that moves on `Post` moves here
 * without anyone touching this file — the fact stays a full entity, card included.
 */
export default class PostPublished extends Post.pick('id', 'title').extend({ at: auto() }) {}
