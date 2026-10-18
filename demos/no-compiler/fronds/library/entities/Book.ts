import { entity, number, primary, text } from '@fougere/schema';

export default class Book extends entity({
  id: primary(),
  title: text({ min: 1 }),
  pages: number({ min: 1 }),
}) {}
