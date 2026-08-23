import Post from './Post.js';

/** What a caller may send to `createDraft` — the author comes from who they are, not from what they type. */
export default class PostDraft extends Post.pick('id', 'title') {}
