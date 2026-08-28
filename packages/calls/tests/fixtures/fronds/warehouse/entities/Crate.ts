import { entity, primary, text } from '@fougere/schema';

export default class Crate extends entity({
  id: primary(),
  code: text(),
}) {}
