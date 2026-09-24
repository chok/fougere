import { entity, primary, text } from '@fougere/schema';

export default class Ledger extends entity({
  id: primary(),
  name: text(),
}) {}
