import { createAppRunner } from '@fougere/core';
import type { App, Plugged } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import pc from 'picocolors';
import { machineWanted, printMachine } from '../../src/machine.js';

type Ui = ReturnType<typeof createUi>;

const SHOWN = 8;

/**
 * Who answers, in the form the point gives them: a registry's names have no order, so they are a list;
 * a port's links have one, outside in, and the realization they reach comes last.
 */
function answered(one: Plugged): string {
  if (one.answers.length === 0) return pc.dim('nothing');
  const ordered = one.by === 'type' || one.point === 'extension';
  const shown = one.answers.slice(0, SHOWN).join(ordered ? pc.dim(' → ') : ', ');

  return one.answers.length > SHOWN ? `${shown} ${pc.dim(`… ${one.answers.length} in all`)}` : shown;
}

/** A frond's ports first, then those with a subject — `Repository<Post>`, `Rest<PostHandler>` — and where it is served before both. */
const rankOf = (one: Plugged): number => (one.point === 'served at' ? 0 : one.point.includes('<') ? 2 : 1);

/** What answers each port, frond by frond, and each registry by name. */
export default class PortsCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const ports = (await createAppRunner(this.app)(
      { address: 'ports', op: 'execute' },
      { params: {}, query: {}, input: raw, state: {} },
    )) as Plugged[];

    if (machineWanted(raw)) return printMachine(ports);

    const line = (one: Plugged) => `${one.point}${one.subject ? ` ${pc.dim(one.subject)}` : ''}  ${pc.dim('·')}  ${answered(one)}`;
    const byName = ports.filter((one) => one.by === 'name' && !one.frond);
    this.ui.note(byName.map(line).join('\n'), 'By name');

    const fronds = [...new Set(ports.flatMap((one) => (one.frond ? [one.frond] : [])))];
    for (const frond of fronds) {
      const answering = ports.filter((one) => one.frond === frond).sort((one, other) => rankOf(one) - rankOf(other));
      this.ui.note(answering.map(line).join('\n'), `Frond ${frond}`);
    }
  }
}
