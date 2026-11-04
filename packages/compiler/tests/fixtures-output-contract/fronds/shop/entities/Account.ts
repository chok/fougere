import { entity, primary, text, writeOnly } from '@fougere/schema';

export default class Account extends entity({
  id: primary(),
  name: text(),
  secret: writeOnly(text()),
}) {}
