import {
  buildGraph, declaredTopologyOf, suggestSplit,
  type DeclaredTopology, type EntityNode, type DomainCluster,
} from '@fougere/core';
import ProjectScan from '../services/ProjectScan.js';
import { remotesOf } from '@fougere/core/node';

export interface GraphResult {
  /** How many fronds the scan found — the descriptors themselves hold classes, which no
   * operation answers: a reader outside this process would receive the husk JSON makes of them. */
  totalFronds: number;
  /** Where the fronds run and which reaches which — the same picture, one altitude up. */
  declared: DeclaredTopology;
  nodes: Record<string, EntityNode>;
  clusters: DomainCluster[];
  totalEntities: number;
  totalRefs: number;
}

export default class GraphHandler {
  constructor(private projectScan: ProjectScan) {}

  /** Report how a workspace's fronds and entities reference each other. */
  async execute(input: { root?: string; minEntities?: number }): Promise<GraphResult> {
    const { fronds, config } = await this.projectScan.at(input.root);
    const nodes = buildGraph(fronds);
    const clusters = suggestSplit(nodes);

    return {
      totalFronds: fronds.length,
      declared: declaredTopologyOf({ fronds, remotes: remotesOf(config) }),
      nodes: Object.fromEntries(nodes),
      clusters,
      totalEntities: nodes.size,
      totalRefs: [...nodes.values()].reduce((sum, n) => sum + n.refs.length, 0),
    };
  }
}
