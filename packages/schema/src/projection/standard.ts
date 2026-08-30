/**
 * The Standard Schema interface, from the package that owns it.
 *
 * This file used to CARRY the spec — 47 lines of hand-copied interface — and the copy had
 * silently fallen a version behind: v1.1 gave `Props` a base it extends (`StandardTypedV1`)
 * and gave `validate` a second `options` parameter. Nothing broke, because a realization may
 * ignore an optional argument, which is exactly why nobody noticed. A standard is owned by
 * whoever publishes it; the package is types only (`index.js` is zero bytes), so importing
 * it costs a browser nothing.
 */
export type { StandardSchemaV1 } from '@standard-schema/spec';
