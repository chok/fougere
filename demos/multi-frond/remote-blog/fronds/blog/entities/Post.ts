import { entity, primary, text, number, auto } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  body: text(),
  views: number({ integer: true, min: 0 }),
  createdAt: auto(),
}) {}
