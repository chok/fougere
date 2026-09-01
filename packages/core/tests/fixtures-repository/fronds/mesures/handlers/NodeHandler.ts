import type { Storage } from '../../../../../src/index.js';
import Node from '../entities/Node.js';

/** No repository was written for Node — the default IS the port, gestures and all. */
type NodeRepository = Storage<Node>;

export default class NodeHandler {
  constructor(private nodes: NodeRepository) {}

  async all() { return this.nodes.list(); }
}
