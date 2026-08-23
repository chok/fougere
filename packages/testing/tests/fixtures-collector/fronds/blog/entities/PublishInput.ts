import { entity, text } from '@fougere/schema';

export default class PublishInput extends entity({
  title: text(),
}) {}
