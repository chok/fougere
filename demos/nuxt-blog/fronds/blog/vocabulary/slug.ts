import { StringFormats } from '@fougere/schema';

/**
 * What this blog calls a slug — the shape a URL segment may take.
 *
 * A word the frond adds to the declaration, not a rule a handler applies: `Category.slug`
 * writes `format: 'slug'` below, and the judge at the door refuses anything else on every
 * surface at once. The JSON Schema engine knows `email` and `uuid` on its own; this is not
 * one of them, so the process lists it in `fronds.ts`, beside the fronds.
 */
export const slug = StringFormats.term('slug', (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value));
