import type { GraphResult } from '../../fronds/analysis/handlers/GraphHandler.js';
import type { EntityNode, DomainCluster, App } from '@fougere/core';
import { createAppRunner } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import pc from 'picocolors';

type Ui = ReturnType<typeof createUi>;

export default class GraphCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    // Ride the call contract — the same envelope every consumer uses.
    const result = await createAppRunner(this.app)(
      { entity: 'graph', op: 'execute' },
      { params: {}, query: {}, body: raw, state: {} },
    ) as GraphResult;

    if (result.fronds.length === 0) {
      this.ui.warn('No fronds found. Run this from a Fougere project root.');
      return;
    }

    this.ui.step(`${pc.bold(String(result.totalEntities))} entities, ${pc.bold(String(result.totalRefs))} refs, ${pc.bold(String(result.fronds.length))} frond(s)`);
    this.ui.note(renderGraph(result.nodes), 'Entity Graph');

    const min = (raw.minEntities as number) ?? 6;
    if (result.clusters.length > 1 && result.totalEntities >= min) {
      this.ui.note(renderClusters(result.clusters), 'Suggested Domains');
    }

    if (result.fronds.length === 1 && result.clusters.length > 1 && result.totalEntities >= min) {
      this.ui.info(`${pc.dim('Tip:')} ${result.clusters.length} natural domains detected. Consider splitting into separate fronds.`);
    }

  }
}

function renderGraph(nodes: Map<string, EntityNode>): string {
  return [...nodes.entries()].map(([name, node]) => {
    const refs = node.refs.length > 0
      ? ` ${pc.dim('→')} ${node.refs.map((r) => pc.cyan(r)).join(', ')}`
      : '';
    const badge = node.referencedBy.length > 0
      ? pc.dim(` (${node.referencedBy.length} incoming)`)
      : '';
    return `  ${pc.bold(name)}${refs}${badge}`;
  }).join('\n');
}

function renderClusters(clusters: DomainCluster[]): string {
  return clusters.map((cluster) => {
    const header = `  ${pc.green(pc.bold(cluster.name + '/'))}  ${pc.dim(`(${cluster.entities.length} entities)`)}`;
    const entities = cluster.entities.map((e) => `    ${e}`);
    const crossRefs = cluster.crossRefs.length > 0
      ? [`    ${pc.dim('cross-refs:')}`, ...cluster.crossRefs.map((r) =>
          `      ${r.from} ${pc.dim('→')} ${pc.yellow(r.to)} ${pc.dim(`(${r.targetCluster})`)}`)]
      : [];
    return [header, ...entities, ...crossRefs, ''].join('\n');
  }).join('\n');
}
