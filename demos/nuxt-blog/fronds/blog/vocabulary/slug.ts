import { Formats } from '@fougere/schema';

/**
 * What this blog calls a slug — the shape a URL segment may take.
 *
 * A word the frond adds to the declaration, not a rule a handler applies: `Category.slug`
 * writes `format: 'slug'` below, and the judge at the door refuses anything else on every
 * surface at once. The JSON Schema engine knows `email` and `uuid` on its own; this is not
 * one of them, so it has to be registered before an entity can name it.
 */
Formats.register('slug', (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value));
