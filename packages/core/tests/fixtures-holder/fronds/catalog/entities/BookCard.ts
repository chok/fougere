import { entity, primary, text, updated } from '@fougere/schema';

export default class BookCard extends entity({
  isbn: primary(),
  title: text(),
  pulledAt: updated(),
}) {}
