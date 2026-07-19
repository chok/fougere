import {
  scanProject, setModuleLoader,
  buildGraph, suggestSplit,
  type EntityNode, type DomainCluster,
} from '@fougere/core';
import type { ui as createUi } from '@fougere/cli-ui';
import pc from 'picocolors';

type Ui = ReturnType<typeof createUi>;

export default class GraphHandler {
  private ui: Ui;
  private cwd: string;

  constructor(ui: Ui, cwd: string) {
    this.ui = ui;
    this.cwd = cwd;
  }

  async execute(input: { root?: string; minEntities?: number }) {
    const { resolve } = await import('node:path');
    const root = resolve(this.cwd, input.root || '.');

    // Load .ts files via jiti
    const { createJiti } = await import('jiti');
    const jiti = createJiti(import.meta.url, { interopDefault: true });
    setModuleLoader((filePath) => jiti.import(filePath) as Promise<Record<string, unknown>>);

    const { fronds } = await scanProject(root);

    if (fronds.length === 0) {
      this.ui.warn('No fronds found. Run this from a Fougere project root.');
      return;
    }

    const nodes = buildGraph(fronds);
    const clusters = suggestSplit(nodes);

    const totalEntities = [...nodes.values()].length;
    const totalRefs = [...nodes.values()].reduce((sum, n) => sum + n.refs.length, 0);

    this.ui.step(`${pc.bold(String(totalEntities))} entities, ${pc.bold(String(totalRefs))} refs, ${pc.bold(String(fronds.length))} frond(s)`);

    // Display current graph
    this.ui.note(renderGraph(nodes), 'Entity Graph');

    // Display suggested clusters (only if enough entities to justify a split)
    const MIN_ENTITIES_FOR_SPLIT = input.minEntities ?? 6;
    if (clusters.length > 1 && totalEntities >= MIN_ENTITIES_FOR_SPLIT) {
      this.ui.note(renderClusters(clusters), 'Suggested Domains');
    } else if (totalEntities >= MIN_ENTITIES_FOR_SPLIT) {
      this.ui.info('All entities are tightly connected — single domain.');
    }

    if (fronds.length === 1 && clusters.length > 1 && totalEntities >= MIN_ENTITIES_FOR_SPLIT) {
      this.ui.info(`${pc.dim('Tip:')} ${clusters.length} natural domains detected. Consider splitting into separate fronds.`);
    }

    this.ui.outro('');
  }
}

function renderGraph(nodes: Map<string, EntityNode>): string {
  const lines: string[] = [];

  for (const [name, node] of nodes) {
    const refs = node.refs.length > 0
      ? ` ${pc.dim('→')} ${node.refs.map((r) => pc.cyan(r)).join(', ')}`
      : '';
    const badge = node.referencedBy.length > 0
      ? pc.dim(` (${node.referencedBy.length} incoming)`)
      : '';
    lines.push(`  ${pc.bold(name)}${refs}${badge}`);
  }

  return lines.join('\n');
}

function renderClusters(clusters: DomainCluster[]): string {
  const lines: string[] = [];

  for (const cluster of clusters) {
    lines.push(`  ${pc.green(pc.bold(cluster.name + '/'))}  ${pc.dim(`(${cluster.entities.length} entities)`)}`);
    for (const entity of cluster.entities) {
      lines.push(`    ${entity}`);
    }
    if (cluster.crossRefs.length > 0) {
      lines.push(`    ${pc.dim('cross-refs:')}`);
      for (const ref of cluster.crossRefs) {
        lines.push(`      ${ref.from} ${pc.dim('→')} ${pc.yellow(ref.to)} ${pc.dim(`(${ref.targetCluster})`)}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
