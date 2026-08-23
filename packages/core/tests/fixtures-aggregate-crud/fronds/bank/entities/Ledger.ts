import { entity, primary, number, text } from '@fougere/schema';

export default class Ledger extends entity({
  id: primary(),
  account: text(),
  amount: number(),
}) {}
