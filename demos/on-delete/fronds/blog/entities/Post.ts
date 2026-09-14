import { entity, optional, primary, ref, text } from '@fougere/schema';
import User from '@fronds/people/entities/User.js';

/**
 * A post names two people, and says a different thing about each.
 *
 * Neither line names a database, a process or a key. What carries them out is decided by
 * where the rows turn out to live — and the boot says which it took.
 */
export default class Post extends entity({
  id: primary(text()),
  title: text(),
  /** Their posts go with them. */
  authorId: ref(User, { onDelete: 'cascade' }),
  /** The post stays, the field is emptied — which is why it has to admit a null. */
  editorId: optional(ref(User, { onDelete: 'set null' })),
}) {}
