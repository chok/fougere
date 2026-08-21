import { entity, text, number, primary } from '@fougere/schema';

/** A balance, and the one rule that makes a refused write worth testing. */
export default class Account extends entity({
  id: primary(text()),
  owner: text(),
  balance: number({ min: 0 }),
}) {}
