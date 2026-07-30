import { entity, primary, text, readOnly, auto } from '@fougere/schema';

export default class Note extends entity({
  id: primary(),
  title: text({ min: 1 }),
  body: text(),
  ownerId: readOnly(text()),
  createdAt: auto(),
}) {}
