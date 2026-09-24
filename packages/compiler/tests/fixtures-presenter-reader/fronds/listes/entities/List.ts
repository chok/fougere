import { entity, primary, text, ref } from '@fougere/schema';
import User from './User.js';

export default class List extends entity({
  id: primary(),
  title: text(),
  ownerUserId: ref(User),
}) {}
