import { entity, primary, text } from '@fougere/schema';

export default class Account extends entity({
  id: primary(),
  label: text(),
}) {}
