import { entity, primary, text } from '@fougere/schema';

/** An entity found under `models/`, because the config says that is where they live. */
export default class Article extends entity({
  id: primary(),
  title: text(),
}) {}
