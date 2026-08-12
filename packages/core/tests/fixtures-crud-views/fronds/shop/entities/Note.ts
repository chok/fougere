import { entity, primary, text, readOnly, created } from '@fougere/schema';

/** Same entity as fixtures-crud — the views are what this fixture is about. */
export default class Note extends entity({
  id: primary(),
  title: text(),
  body: text(),
  ownerId: readOnly(text()),
  createdAt: created(),
}) {}
