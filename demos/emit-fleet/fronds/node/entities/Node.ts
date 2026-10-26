import { entity, text } from '@fougere/schema';

/** Which device this process is — read from `NODE_ID`, so one build runs on every one of them. */
export default class Node extends entity({
  id: text({ default: 'sensor-1' }),
}) {}
