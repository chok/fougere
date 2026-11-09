import { entity, json, primary, text } from '@fougere/schema';

/** Where a source that holds rows keeps a value: one row per entity, keyed by its name. */
export default class FougereValue extends entity({
  name: primary(text()),
  value: json(),
}) {}

/** The name it is registered under, spelled once. */
export const FOUGERE_VALUE = 'fougereValue';
