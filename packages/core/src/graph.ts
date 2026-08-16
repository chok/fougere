import { Role } from '@fougere/schema';
/**
 * Entity dependency graph — analyzes ref() links between entities
 * to suggest domain boundaries for splitting fronds.
 */
import type { FrondDescriptor, EntityEntry } from './frond.js';

export interface EntityNode {
  name: string;
  frond: string;
  refs: string[];       // entity names this entity references
  referencedBy: string[]; // entity names that reference this entity
}

export interface DomainCluster {
  name: string;
  entities: string[];
  crossRefs: { from: string; to: string; targetCluster: string }[];
}

/** Build the full entity dependency graph from scanned fronds. */
export function buildGraph(fronds: FrondDescriptor[]): Map<string, EntityNode> {
  const nodes = new Map<string, EntityNode>();

  // First pass: create nodes and collect refs
  for (const frond of fronds) {
    for (const entity of frond.entities) {
      const refs: string[] = [];
      for (const [, field] of Object.entries(entity.entityClass.getFields())) {
        if (Role.of(field).isReference) {
          const resolved = Role.of(field).target;
          const targetName = typeof resolved === 'function' && 'name' in resolved
            ? (resolved.name as string).toLowerCase()
            : undefined;
          if (targetName) refs.push(targetName);
        }
      }
      nodes.set(entity.name, { name: entity.name, frond: frond.name, refs, referencedBy: [] });
    }
  }

  // Second pass: populate referencedBy
  for (const [, node] of nodes) {
    for (const ref of node.refs) {
      const target = nodes.get(ref);
      if (target) target.referencedBy.push(node.name);
    }
  }

  return nodes;
}

/**
 * Cluster entities into domains using connected component analysis.
 * Entities linked by refs (in either direction) belong to the same cluster.
 */
export function clusterEntities(nodes: Map<string, EntityNode>): DomainCluster[] {
  const visited = new Set<string>();
  const clusters: string[][] = [];

  // BFS to find connected components
  for (const [name] of nodes) {
    if (visited.has(name)) continue;

    const cluster: string[] = [];
    const queue = [name];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      cluster.push(current);

      const node = nodes.get(current)!;
      for (const ref of [...node.refs, ...node.referencedBy]) {
        if (!visited.has(ref) && nodes.has(ref)) {
          queue.push(ref);
        }
      }
    }

    if (cluster.length > 0) clusters.push(cluster);
  }

  // Name each cluster by its hub (most referenced entity)
  return clusters.map((entities) => {
    const hub = entities
      .map((name) => ({ name, score: nodes.get(name)!.referencedBy.length }))
      .sort((a, b) => b.score - a.score)[0];

    return {
      name: hub.name,
      entities,
      crossRefs: [],
    };
  });
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
  const result = subClusters.map((entities) => {
    const hub = entities
      .map((name) => ({ name, score: nodes.get(name)!.referencedBy.length }))
      .sort((a, b) => b.score - a.score)[0];
    return { name: hub.name, entities, crossRefs: [] as DomainCluster['crossRefs'] };
  });

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
