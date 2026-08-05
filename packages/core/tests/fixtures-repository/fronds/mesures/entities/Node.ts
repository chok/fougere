import { entity, primary, text } from '@fougere/schema';

/** No repository file — its default must still resolve. */
export default class Node extends entity({
  id: primary(),
  room: text(),
}) {}
