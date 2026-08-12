import { entity, created, number, optional, text } from '@fougere/schema';

/**
 * Down the fleet. `node` absent means EVERYONE.
 *
 * Addressing one device is done here, in the DATA — `remotes:` names a kind of Frond and
 * never an instance, so the name travels with the fact and each device decides for itself.
 * It works, and it is wasteful: five hundred machines wake up for an order meant for one.
 */
export default class Recalibrate extends entity({
  node: optional(text()),
  offset: number(),
  at: created(),
}) {}
