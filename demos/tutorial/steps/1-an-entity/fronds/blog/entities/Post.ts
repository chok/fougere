import { entity, oneOf, primary, text } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 160 }),
  status: oneOf('draft', 'published', { default: 'draft' }),
}) {}
