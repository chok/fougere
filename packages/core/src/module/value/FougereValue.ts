import { entity, json, primary, text } from '@fougere/schema';

/**
 * Where a source that holds rows keeps an entity listed in `values:` — one row per entity, keyed
 * by its name, so `pending`, `migrate` and the read are the source's own gestures over rows.
 */
export default class FougereValue extends entity({
  name: primary(text()),
  value: json(),
}) {}

/** The name it is registered under, spelled once. */
export const FOUGERE_VALUE = 'fougereValue';
