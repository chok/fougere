import { entity, text, number, primary, created } from '@fougere/schema';

/** The line that must exist if and only if the balance moved. */
export default class Ledger extends entity({
  id: primary(text()),
  from: text(),
  to: text(),
  amount: number(),
  at: created(),
}) {}
