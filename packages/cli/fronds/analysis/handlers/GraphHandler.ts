import {
  buildGraph, suggestSplit,
  type EntityNode, type DomainCluster, type FrondDescriptor,
} from '@fougere/core';
import ProjectScan from '../services/ProjectScan.js';

export interface GraphResult {
  fronds: FrondDescriptor[];
  nodes: Map<string, EntityNode>;
  clusters: DomainCluster[];
  totalEntities: number;
  totalRefs: number;
}

export default class GraphHandler {
  constructor(private projectScan: ProjectScan) {}

  /** Report how a workspace's fronds and entities reference each other. */
  async execute(input: { root?: string; minEntities?: number }): Promise<GraphResult> {
    const { fronds } = await this.projectScan.at(input.root);
    const nodes = buildGraph(fronds);
    const clusters = suggestSplit(nodes);

    return {
      fronds,
      nodes,
      clusters,
      totalEntities: nodes.size,
      totalRefs: [...nodes.values()].reduce((sum, n) => sum + n.refs.length, 0),
    };
  }
}
