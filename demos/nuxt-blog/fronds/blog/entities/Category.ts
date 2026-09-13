import { entity, primary, text, number } from '@fougere/schema';

export default class Category extends entity({
  id: primary(),
  name: text({ min: 1, max: 100 }),
  slug: text({ min: 1, max: 100, format: 'slug' }),
  postCount: number({ integer: true }),
}) {}
