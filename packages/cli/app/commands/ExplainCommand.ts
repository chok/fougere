import type { App } from '@fougere/core';
import { createAppRunner } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import type {
  ExplainResult,
  ExplainedBinding,
} from '../../fronds/analysis/handlers/ExplainHandler.js';
import pc from 'picocolors';

type Ui = ReturnType<typeof createUi>;

export default class ExplainCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const result = await createAppRunner(this.app)(
      { entity: 'explain', op: 'execute' },
      { params: {}, query: {}, body: raw, state: {} },
    ) as ExplainResult;

    if (raw.json === true) {
      process.stdout.write(renderExplainJson(result) + '\n');
      return;
    }

    this.ui.note(renderExplain(result), result.operation);
  }
}

export function renderExplainJson(result: ExplainResult): string {
  return JSON.stringify(result, null, 2);
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

function bindingName(binding: ExplainedBinding | null): string {
  if (!binding) return 'unbound';
  switch (binding.kind) {
    case 'collector': return `collector:${binding.typeName}`;
    case 'fact': return `fact:${binding.factName}`;
    case 'param': return `param:${binding.name}${binding.coerce ? ` (${binding.coerce})` : ''}`;
    default: return binding.kind;
  }
}
