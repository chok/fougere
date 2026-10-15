import { entity, primary, text, oneOf, number, created } from '@fougere/schema';

export default class Article extends entity({
  id: primary(),
  title: text({ min: 3, max: 40 }),
  body: text({ min: 1 }),
  status: oneOf('draft', 'published'),
  views: number({ integer: true, min: 0, max: 1000 }),
  createdAt: created(),
}) {}
