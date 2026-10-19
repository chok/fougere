import { Graph } from '@fougere/graph';
import type { FrondDescriptor } from './descriptor/FrondDescriptor.js';
import type { EntityNode } from './EntityNode.js';
import { relationGraph } from './module/relation/relationGraph.js';

export interface DomainCluster {
  name: string;
  entities: string[];
  crossRefs: { from: string; to: string; targetCluster: string }[];
}

/** Each entity of the fronds, with what it names and what names it. */
export function buildGraph(fronds: FrondDescriptor[]): Map<string, EntityNode> {
  const relations = relationGraph(fronds);

  return new Map(fronds.flatMap((frond) => frond.entities.map((entity) => [entity.name, {
    name: entity.name,
    frond: frond.name,
    refs: relations.outgoing(entity.name).map((edge) => edge.to),
    referencedBy: relations.incoming(entity.name).map((edge) => edge.from),
  }] as const)));
}

/** The entities a `ref()` joins, whichever way it points, each group named by its most referenced. */
export function clusterEntities(nodes: Map<string, EntityNode>): DomainCluster[] {
  const joined = new Graph();
  for (const node of nodes.values()) joined.add(node.name);
  for (const node of nodes.values()) {
    for (const ref of node.refs) joined.connect(node.name, ref, ref);
  }

  return joined.components()
    .map((component) => component.filter((name) => nodes.has(name)))
    .filter((entities) => entities.length > 0)
    .map((entities) => ({ name: hubOf(entities, nodes), entities, crossRefs: [] }));
}

function hubOf(entities: string[], nodes: Map<string, EntityNode>): string {
  return entities
    .map((name) => ({ name, score: nodes.get(name)!.referencedBy.length }))
    .sort((a, b) => b.score - a.score)[0].name;
}

/**
 * If there's only one big cluster, try to split it using Kernighan-Lin-style
 * heuristic: find the entity with the fewest cross-links and use it as a cut point.
 */
export function suggestSplit(
  nodes: Map<string, EntityNode>,
  minClusterSize = 2,
): DomainCluster[] {
  const clusters = clusterEntities(nodes);

  // If already multiple clusters, just annotate cross-refs
  if (clusters.length > 1) {
    return annotateCrossRefs(clusters, nodes);
  }

  // No entities at all — nothing to cluster (empty or fresh workspace).
  if (clusters.length === 0) return clusters;

  // Single cluster — try to find natural cut points
  const allEntities = clusters[0].entities;
  if (allEntities.length <= minClusterSize) return clusters;

  // Score each entity by how many unique "groups" it connects
  // Entities with high betweenness are boundaries, not cluster members
  const subClusters: string[][] = [];
  const assigned = new Set<string>();

  // Start with entities that have no outgoing refs (leaves/roots)
  const roots = allEntities.filter((name) => nodes.get(name)!.refs.length === 0);

  for (const root of roots) {
    if (assigned.has(root)) continue;
    const group: string[] = [root];
    assigned.add(root);

    // Add entities that reference this root
    for (const refBy of nodes.get(root)!.referencedBy) {
      if (!assigned.has(refBy)) {
        group.push(refBy);
        assigned.add(refBy);
      }
    }
    subClusters.push(group);
  }

  // Any remaining unassigned entities form their own group
  const remaining = allEntities.filter((name) => !assigned.has(name));
  if (remaining.length > 0) subClusters.push(remaining);

  // Convert to domain clusters
  const result = subClusters.map((entities) => ({ name: hubOf(entities, nodes), entities, crossRefs: [] as DomainCluster['crossRefs'] }));

  return annotateCrossRefs(result, nodes);
}

function annotateCrossRefs(clusters: DomainCluster[], nodes: Map<string, EntityNode>): DomainCluster[] {
  const entityToCluster = new Map<string, string>();
  for (const cluster of clusters) {
    for (const entity of cluster.entities) {
      entityToCluster.set(entity, cluster.name);
    }
  }

  for (const cluster of clusters) {
    for (const entity of cluster.entities) {
      const node = nodes.get(entity)!;
      for (const ref of node.refs) {
        const targetCluster = entityToCluster.get(ref);
        if (targetCluster && targetCluster !== cluster.name) {
          cluster.crossRefs.push({ from: entity, to: ref, targetCluster });
        }
      }
    }
  }

  return clusters;
}
