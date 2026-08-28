import { entity, primary, text } from '@fougere/schema';

export default class Order extends entity({
  id: primary(),
  label: text(),
}) {}
