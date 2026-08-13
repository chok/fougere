import { entity, primary, text, oneOf } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text({ min: 1 }),
  author: text(),
  status: oneOf('draft', 'published', { default: 'draft' }),
}) {}
