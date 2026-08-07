import { entity, primary, text } from '@fougere/schema';

export default class Article extends entity({
  id: primary(),
  title: text(),
}) {}
