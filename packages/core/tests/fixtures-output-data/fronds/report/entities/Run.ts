import { created, entity, primary, text } from '@fougere/schema';

export default class Run extends entity({
  id: primary(),
  label: text(),
  startedAt: created(),
}) {}
