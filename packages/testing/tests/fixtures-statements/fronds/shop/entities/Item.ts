import { entity, primary, text } from '@fougere/schema';

export default class Item extends entity({
  id: primary(),
  name: text({ min: 1 }),
}) {}
