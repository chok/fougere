import { entity, primary, number, text } from '@fougere/schema';

export default class Account extends entity({
  id: primary(),
  holder: text(),
  balance: number({ min: 0 }),
}) {}
