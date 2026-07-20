import {
  scanProject, setModuleLoader,
  buildGraph, suggestSplit,
  type EntityNode, type DomainCluster, type FrondDescriptor,
} from '@fougere/core';

export interface GraphResult {
  fronds: FrondDescriptor[];
  nodes: Map<string, EntityNode>;
  clusters: DomainCluster[];
  totalEntities: number;
  totalRefs: number;
}

export default class GraphHandler {
  // cwd is ambient in a CLI — not a DI service (the container resolves by type).
  private cwd = process.cwd();

  async execute(input: { root?: string; minEntities?: number }): Promise<GraphResult> {
    const { resolve } = await import('node:path');
    const root = resolve(this.cwd, input.root || '.');

    const { createJiti } = await import('jiti');
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

    const { fronds } = await scanProject(root);
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
