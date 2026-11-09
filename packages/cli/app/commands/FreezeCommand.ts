import { createAppRunner } from '@fougere/core';
import type { Change } from '@fougere/schema';
import type { App } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import type { FreezeInspection } from '../../fronds/analysis/handlers/FreezeHandler.js';
import pc from 'picocolors';
import { machineWanted, printMachine } from '../../src/machine.js';

type Ui = ReturnType<typeof createUi>;

/** Cuts a version: inspects, asks what only a human knows, then records. */
export default class FreezeCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    if (!raw.version) {
      this.ui.error('Usage: fougere freeze <version>');

      return;
    }

    const freeze = (input: Record<string, unknown>) =>
      createAppRunner(this.app)({ address: 'freeze', op: 'execute' }, { params: {}, query: {}, input, state: {} }) as Promise<FreezeInspection>;

    const seen = await freeze(raw);

    if (machineWanted(raw)) return printMachine(seen);

    if (seen.entities.length === 0) {
      this.ui.warn('No entities found. Run this from a Fougere project root.');

      return;
    }

    if (seen.written) {
      this.report(seen);

      return;
    }

    const renamed = await this.settle(seen);
    if (renamed === undefined) return;

    this.report(await freeze({ ...raw, renamed }));
  }

  private async settle(seen: FreezeInspection): Promise<Record<string, Record<string, string>> | undefined> {
    const renamed: Record<string, Record<string, string>> = {};
    const pending = Object.entries(seen.ambiguous);
    if (pending.length === 0) return renamed;

    this.ui.warn('A field left and a field of the same shape appeared. Only you know which.');

    for (const [entity, pairs] of pending) {
      const byRemoved = new Map<string, string[]>();
      for (const { removed, added } of pairs) byRemoved.set(removed, [...(byRemoved.get(removed) ?? []), added]);

      for (const [removed, candidates] of byRemoved) {
        const answer = await this.ui.select({
          message: `${entity}.${pc.bold(removed)} — what happened to it?`,
          options: [
            ...candidates.map((added) => ({ value: added, label: `renamed to ${added}`, hint: 'the data moves with it' })),
            { value: '', label: 'dropped', hint: 'the column goes, and what it held goes with it' },
          ],
        });
        if (!answer) {
          this.ui.warn(`${entity}.${removed} treated as dropped — say so explicitly if that is right.`);

          return undefined;
        }
        renamed[entity] = { ...renamed[entity], [removed]: answer };
      }
    }

    return renamed;
  }

  private report(written: FreezeInspection) {
    const { step } = written;
    if (!step) {
      this.ui.success(`${written.version} recorded — ${written.entities.length} entities, and nothing before it`);

      return;
    }

    const moved = Object.entries(step.entities);
    const count = moved.reduce((total, [, answer]) => total + answer.changes.length, 0);

    this.ui.success(`${written.version} recorded — ${count} change(s) since ${written.previous}`);
    for (const [entity, answer] of moved) {
      this.ui.step(`${pc.bold(entity)} — ${answer.changes.map(describeChange).join(', ')}`);
    }
    for (const [entity, answer] of moved) {
      for (const change of answer.changes) {
        if (change.kind === 'removed') this.ui.warn(`${entity}.${change.field} and its data are deleted at the next migrate. If it was renamed, say so on the field with previous:.`);
      }
    }
    if (step.entitiesAdded.length > 0) this.ui.step(`new: ${step.entitiesAdded.join(', ')}`);
    if (step.entitiesRemoved.length > 0) this.ui.step(`gone: ${step.entitiesRemoved.join(', ')}`);
  }
}

function describeChange(change: Change): string {
  if (change.kind === 'renamed') return `${change.from} → ${change.to}`;
  if (change.kind === 'restated') return `${change.field}: ${change.axis} moved`;

  return `${change.kind} ${change.field}`;
}
