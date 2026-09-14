import { entity, primary, ref, text } from '@fougere/schema';
import Post from '@fronds/blog/entities/Post.js';
import User from '@fronds/people/entities/User.js';

/** A comment hangs off a post, and is signed. The two are not the same question. */
export default class Comment extends entity({
  id: primary(text()),
  body: text(),
  /** It goes with the post it hangs off. */
  postId: ref(Post, { onDelete: 'cascade' }),
  /** Nothing stated: its author may not go while the comment stands — what a key already does. */
  authorId: ref(User),
}) {}
