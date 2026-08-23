import { entity, text } from '@fougere/schema';

export default class Observed extends entity({
  title: text(),
  role: text(),
}) {}
