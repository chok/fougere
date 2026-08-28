import type { App } from '@fougere/core';
import { createAppRunner } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import type {
  ExplainResult,
  ExplainListing,
  ExplainedBinding,
} from '../../fronds/analysis/handlers/ExplainHandler.js';
import pc from 'picocolors';
import { machineText, printMachine } from '../../src/machine.js';

type Ui = ReturnType<typeof createUi>;

export default class ExplainCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const names = raw.names as 'operations' | 'fronds' | undefined;
    const operation = (raw.operation as string | undefined)?.trim();

    // No operation named — the question is what this project serves at all. The same
    // model answers both, so the door is the one that was asked, never a guess.
    if (names || !operation) return this.listing(raw, names);

    const result = await this.ask('execute', raw) as ExplainResult;

    if (raw.json === true) return printMachine(result);

    this.ui.note(renderExplain(result), result.operation);
  }

  private async listing(raw: Record<string, unknown>, names?: 'operations' | 'fronds') {
    const listing = await this.ask('list', raw) as ExplainListing;

    // A completion script has no JSON parser: one name per line, nothing else on stdout.
    if (names) {
      const values = names === 'fronds'
        ? listing.fronds.map((frond) => frond.name)
        : listing.operations;
      if (values.length > 0) process.stdout.write(values.join('\n') + '\n');
      return;
    }

    if (raw.json === true) return printMachine(listing);

    this.ui.note(renderListing(listing), 'what this project serves');
  }

  private ask(op: string, raw: Record<string, unknown>) {
    return createAppRunner(this.app)(
      { entity: 'explain', op },
      { params: {}, query: {}, body: raw, state: {} },
    );
  }
}

/** Kept as the name `tests/explain.test.ts` pins the key order through. */
export function renderExplainJson(result: ExplainResult): string {
  return machineText(result);
}

export function renderExplain(result: ExplainResult): string {
  const lines = [
    `${pc.dim('Handler:')}   ${result.handler.class}.${result.handler.method}`,
    `${pc.dim('Address:')}   ${result.handler.address}.${result.operation.split('.').at(-1)}`,
    `${pc.dim('Kind:')}      ${result.kind}`,
    `${pc.dim('Input:')}     ${result.input ?? '—'}`,
    `${pc.dim('Output:')}    ${result.output ? `${result.output.type}${result.output.cardinality ? ` (${result.output.cardinality})` : ''}` : '—'}`,
  ];

  if (result.description) lines.push(`${pc.dim('Purpose:')}   ${result.description}`);

  lines.push('', pc.bold('Parameters'));
  if (result.parameters.length === 0) lines.push('  —');
  for (const parameter of result.parameters) {
    const optional = parameter.optional ? '?' : '';
    lines.push(`  ${parameter.name}${optional}: ${parameter.type ?? 'unknown'} ${pc.dim('→')} ${bindingName(parameter.binding)}`);
  }

  lines.push('', pc.bold('Collectors'));
  if (result.collectors.length === 0) lines.push('  —');
  for (const collector of result.collectors) {
    lines.push(`  ${collector.typeName} ${pc.dim('→')} ${collector.class}`);
  }

  lines.push(
    '',
    `${pc.dim('Surfaces:')}  ${result.exposure.surfaces.join(', ') || '—'}`,
    `${pc.dim('Adapters:')}  ${result.exposure.adapters.join(', ') || '—'}`,
    `${pc.dim('Placement:')} ${result.placement.frond} / ${result.placement.runtime}${result.placement.remote ? ` (${result.placement.remote})` : ''}`,
  );

  if (result.handler.file) lines.push(`${pc.dim('Source:')}    ${result.handler.file}`);
  return lines.join('\n');
}

export function renderListing(listing: ExplainListing): string {
  const lines = [pc.bold('Fronds')];
  if (listing.fronds.length === 0) lines.push('  —');
  for (const frond of listing.fronds) {
    const where = frond.remote ? `remote ${pc.dim(frond.remote)}` : 'local';
    lines.push(`  ${frond.name} ${pc.dim('→')} ${where}, ${frond.operations} operation(s)`);
  }

  lines.push('', pc.bold('Operations'));
  if (listing.operations.length === 0) lines.push('  —');
  for (const operation of listing.operations) lines.push(`  ${operation}`);

  return lines.join('\n');
}

function bindingName(binding: ExplainedBinding | null): string {
  if (!binding) return 'unbound';
  switch (binding.kind) {
    case 'collector': return `collector:${binding.typeName}`;
    case 'fact': return `fact:${binding.factName}`;
    case 'param': return `param:${binding.name}${binding.coerce ? ` (${binding.coerce})` : ''}`;
    default: return binding.kind;
  }
}
