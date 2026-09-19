import { entity, number, optional, primary, readOnly, text, writeOnly } from '@fougere/schema';

export default class Product extends entity({
  id: primary(),
  name: text(),
  cost: readOnly(writeOnly(optional(number()))),
}) {}
