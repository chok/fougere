import { date, entity, primary, text } from '@fougere/schema';

export default class Book extends entity({
  id: primary(),
  title: text(),
  shelvedAt: date(),
}) {}
