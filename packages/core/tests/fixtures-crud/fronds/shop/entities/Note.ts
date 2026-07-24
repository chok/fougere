import { entity, primary, text, readOnly, auto } from '@fougere/schema';

/** Entity with the axes that judge a client input: read-only + system-stamped. */
export default class Note extends entity({
  id: primary(),
  title: text(),
  ownerId: readOnly(text()),
  createdAt: auto(),
}) {}
