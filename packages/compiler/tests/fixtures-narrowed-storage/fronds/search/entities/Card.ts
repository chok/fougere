import { entity, primary, text } from '@fougere/schema';

export default class Card extends entity({
  id: primary(),
  title: text(),
}) {}
