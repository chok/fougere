import { createAppRunner } from '@fougere/core';
import { lowerFirst } from '@fougere/core/contract';
import type { App } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';

type Ui = ReturnType<typeof createUi>;

function parseFlags(tokens: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (!t.startsWith('--')) continue;
    const eq = t.indexOf('=');
    if (eq !== -1) { out[t.slice(2, eq)] = t.slice(eq + 1); continue; }
    const key = t.slice(2);
    const next = tokens[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else { out[key] = next; i++; }
  }

  return out;
}

/** Drives one operation on the project's app and prints the result, wherever `remotes:` places it. */
export default class CallCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const target = raw.operation as string | undefined;
    if (!target || !target.includes('.')) {
      this.ui.error('Usage: fougere call <address>.<op> [--field value …] — post.list, post.create --title …');

      return;
    }
    const [address, op] = target.split('.');

    const { bootApp } = await import('@fougere/defaults');
    const app = await bootApp(process.cwd(), {});
    try {
      const { params, input } = CallCommand.invocationOf(app, lowerFirst(address), op, parseFlags(process.argv.slice(2)));
      const result = await createAppRunner(app)(
        { address: lowerFirst(address), op },
        { params, query: {}, input, state: {} },
      );
      this.ui.note(JSON.stringify(result, null, 2), target);
    } finally {
      await app.dispose();
    }
  }

  private static invocationOf(app: App, address: string, op: string, flags: Record<string, unknown>) {
    const contract = app.fronds
      .flatMap((frond) => frond.handlers)
      .find((handler) => handler.address === address)
      ?.operations?.get(op);
    const named = new Set((contract?.binding ?? [])
      .flatMap((binding) => binding.source.kind === 'param' ? [binding.source.name] : []));
    const params: Record<string, string> = {};
    const input: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(flags)) {
      if (named.has(key)) params[key] = String(value);
      else input[key] = value;
    }

    return { params, input };
  }
}
