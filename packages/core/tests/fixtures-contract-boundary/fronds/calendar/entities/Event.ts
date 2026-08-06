import { entity, primary, text } from '@fougere/schema';

export default class Event extends entity({
  id: primary(),
  title: text(),
}) {}
