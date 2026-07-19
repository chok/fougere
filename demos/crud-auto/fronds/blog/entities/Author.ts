import { entity, primary, text } from '@fougere/schema';

export default class Author extends entity({
  id: primary(),
  name: text({ min: 1, max: 100 }),
  email: text({ min: 5 }),
}) {}
