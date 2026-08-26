import { createAppRunner } from '@fougere/core';
import { lowerFirst } from '@fougere/core/contract';
import { bootAppFromConfig } from '@fougere/defaults';
import type { App } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';

type Ui = ReturnType<typeof createUi>;

/**
 * Parse `--field value` / `--field=value` / `--flag` from the raw argv.
 * `call`'s payload is free-form (any entity's fields), so it can't be declared
 * on the Call entity — citty would boolean-ify undeclared flags. We read the
 * tail ourselves; positionals (the target) are ignored (not `--`-prefixed).
 */
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

/**
 * The client end of the gradient: drive one operation on the project's app and
 * print the result. It follows the topology — if `remotes:` sends the frond
 * elsewhere, the call travels there. Same envelope every consumer uses.
 */
export default class CallCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const target = raw.target as string | undefined;
    if (!target || !target.includes('.')) {
      this.ui.error('Usage: fougere call <entity>.<op> [--field value …]');
      return;
    }
    const [entityName, op] = target.split('.');

    // Flags → invocation, by the same rule the framework's binding uses:
    // a primitive param (like `id`) resolves from `params`, an object from
    // `body`. So `--id` is a route param, every other flag is the body.
    const flags = parseFlags(process.argv.slice(2));
    const params: Record<string, string> = {};
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(flags)) {
      if (k === 'id') params.id = String(v);
      else body[k] = v;
    }

    const app = await bootAppFromConfig(process.cwd(), {});
    try {
      const result = await createAppRunner(app)(
        { entity: lowerFirst(entityName), op },
        { params, query: {}, body, state: {} },
      );
      this.ui.note(JSON.stringify(result, null, 2), target);
    } finally {
      await app.dispose();
    }
  }
}
