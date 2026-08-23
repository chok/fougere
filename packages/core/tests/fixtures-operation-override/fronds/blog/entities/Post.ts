import { entity, primary, text } from '@fougere/schema';

export default class Post extends entity({
  id: primary(),
  title: text(),
  handledBy: text(),
}) {}
