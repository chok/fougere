import { entity, oneOf, primary, readOnly, text } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text({ min: 1, max: 160 }),
  status: readOnly(oneOf('draft', 'published', { default: 'draft' })),
}) {}
