import { entity, primary, text } from '@fougere/schema';

/** Someone who writes, edits or comments. Nothing here says what becomes of their work. */
export default class User extends entity({
  id: primary(text()),
  name: text(),
}) {}
