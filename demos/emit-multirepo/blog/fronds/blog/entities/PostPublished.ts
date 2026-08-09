import { auto } from '@fougere/schema';
import Post from './Post.js';

/** The fact this repository announces. Nothing here knows a search engine exists. */
export default class PostPublished extends Post.pick('id', 'title').extend({ at: auto() }) {}
