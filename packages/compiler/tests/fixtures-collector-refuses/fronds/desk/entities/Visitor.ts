import { entity, primary, text } from '@fougere/schema';

export default class Visitor extends entity({
  id: primary(),
  name: text(),
}) {}
