import { entity, primary, text, bool } from '@fougere/schema';

export default class Task extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  description: text(),
  done: bool(),
}) {}
