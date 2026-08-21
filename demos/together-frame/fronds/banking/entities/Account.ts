import { entity, text, number, primary } from '@fougere/schema';

/** A balance the entity itself refuses to take below zero. */
export default class Account extends entity({
  id: primary(text()),
  owner: text(),
  balance: number({ min: 0 }),
}) {}
