/**
 * Contract drift moved to `@fougere/core`, beside the card it compares.
 *
 * Republished here because a test states its subject by where it sits, and `agrees(driftOf(…))`
 * is a testing gesture — the function is core's, the assertion is this package's.
 */
export { driftOf, agrees, explain, type CardDrift } from '@fougere/core';
