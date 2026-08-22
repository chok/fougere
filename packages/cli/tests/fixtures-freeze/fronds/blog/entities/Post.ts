import { entity, primary, text } from '@fougere/schema';

/** `email` became `mail`, and the entity says so rather than leaving it to be guessed. */
export default class Post extends entity(
  { id: primary(), title: text(), mail: text() },
  { previous: { mail: 'email' } },
) {}
