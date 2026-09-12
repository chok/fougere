import type { GraphResult } from '../../fronds/analysis/handlers/GraphHandler.js';
import type { DeclaredTopology, EntityNode, DomainCluster, App } from '@fougere/core';
import { createAppRunner } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import pc from 'picocolors';
import { machineWanted, printMachine } from '../../src/machine.js';

type Ui = ReturnType<typeof createUi>;

export default class GraphCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    // Ride the call contract — the same envelope every consumer uses.
    const result = await createAppRunner(this.app)(
      { entity: 'graph', op: 'execute' },
      { params: {}, query: {}, input: raw, state: {} },
    ) as GraphResult;

    if (machineWanted(raw)) return printMachine(result);

    if (result.fronds.length === 0) {
      this.ui.warn('No fronds found. Run this from a Fougere project root.');
      return;
    }

    this.ui.step(`${pc.bold(String(result.totalEntities))} entities, ${pc.bold(String(result.totalRefs))} refs, ${pc.bold(String(result.fronds.length))} frond(s)`);
    this.ui.note(renderFronds(result.declared), 'Fronds');
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

/**
 * Where each frond runs, and which reaches which. Read from `remotes:` and from what handlers
 * ask for — never from a call, so this says the same thing with nothing running.
 */
function renderFronds(declared: DeclaredTopology): string {
  const reached = new Map<string, string[]>();
  for (const edge of declared.edges) {
    reached.set(edge.from, [...(reached.get(edge.from) ?? []), edge.to]);
  }

  const width = Math.max(0, ...declared.fronds.map((one) => one.frond.length));

  return declared.fronds.map((one) => {
    const name = pc.bold(one.frond.padEnd(width));
    const where = one.placement === 'local' ? pc.dim('local ') : pc.yellow('remote');
    const at = one.at ? `  ${pc.dim(one.at)}` : '';
    const calls = reached.get(one.frond);
    const out = calls ? `  ${pc.dim('→')} ${calls.map((to) => pc.cyan(to)).join(', ')}` : '';

    return `  ${name}  ${where}${at}${out}`;
  }).join('\n');
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
