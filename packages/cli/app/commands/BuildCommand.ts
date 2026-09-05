import { createAppRunner } from '@fougere/core';
import type { App } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import type { BuildReport } from '../../fronds/analysis/handlers/BuildHandler.js';
import pc from 'picocolors';
import { machineWanted, printMachine } from '../../src/machine.js';

type Ui = ReturnType<typeof createUi>;

/**
 * `fougere build` — the scan, written down.
 *
 * It reports what the module HOLDS rather than that it was written: a build that found
 * one frond where the project has three has succeeded at the wrong thing, and the path
 * alone does not say so.
 */
export default class BuildCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const built = (await createAppRunner(this.app)(
      { entity: 'build', op: 'execute' },
      { params: {}, query: {}, input: raw, state: {} },
    )) as BuildReport;

    if (machineWanted(raw)) return printMachine(built);

    if (built.fronds.length === 0) {
      this.ui.warn('No fronds found. Run this from a Fougere project root.');
      return;
    }

    this.ui.success(`${built.path} — ${built.fronds.length} frond(s), ${built.entities} entities, ${built.handlers} handlers`);
    this.ui.step(built.fronds.map((name) => pc.bold(name)).join(', '));

    // A diagnostic travels INTO the module, so a boot from it says the same thing. Saying
    // it here too is not a duplicate: this is the moment someone can still fix the source.
    for (const diagnostic of built.diagnostics) this.ui.warn(diagnostic);

    this.ui.step(pc.dim('hand it to createApp as `scan:` — nothing reads a disk after this'));
  }
}
