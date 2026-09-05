import { entity, primary, text, readOnly, created } from '@fougere/schema';

/** Entity with the axes that validate a client input: read-only + system-stamped. */
export default class Note extends entity({
  id: primary(),
  title: text(),
  ownerId: readOnly(text()),
  createdAt: created(),
}) {}
