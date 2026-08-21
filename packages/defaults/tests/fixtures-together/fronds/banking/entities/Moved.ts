import { entity, text, number, primary, created } from '@fougere/schema';

/** A fact, announced when a transfer really happened. */
export default class Moved extends entity({
  id: primary(text()),
  amount: number(),
  at: created(),
}) {}
