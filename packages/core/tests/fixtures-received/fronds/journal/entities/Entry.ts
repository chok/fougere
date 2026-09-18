import { created, entity, primary, text } from '@fougere/schema';

export default class Entry extends entity({
  id: primary(),
  label: text(),
  at: created(),
}) {}
