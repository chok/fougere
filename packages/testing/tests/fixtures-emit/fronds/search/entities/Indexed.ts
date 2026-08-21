import { entity, primary, text } from '@fougere/schema';

export default class Indexed extends entity({
  id: primary(),
  postId: text({ min: 1 }),
  title: text({ min: 1 }),
}) {}
