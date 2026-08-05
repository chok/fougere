import type { RepositoryOf } from '../../../../../src/index.js';
import Node from '../entities/Node.js';

/** No repository was written for Node — the default is the port itself. */
type NodeRepository = RepositoryOf<Node>;

export default class NodeHandler {
  constructor(private nodeRepository: NodeRepository) {}

  async all() { return this.nodeRepository.orm.list(); }
}
