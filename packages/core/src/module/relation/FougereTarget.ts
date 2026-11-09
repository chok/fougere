import { entity, primary, text } from '@fougere/schema';

/**
 * A row another source holds, as the source naming it marks it: `live` while writes name it, `gone` once its release began.
 *
 * Documented: [entities](https://fougere.dev/docs/concepts/entity).
 */
export default class FougereTarget extends entity({
  id: primary(text()),
  state: text(),
}) {}

/** The name it is registered under, spelled once. */
export const FOUGERE_TARGET = 'fougereTarget';

/** The id a target's mark is kept under — `user#ada`. */
export function markOf(entity: string, key: unknown): string {
  return `${entity}#${String(key)}`;
}
