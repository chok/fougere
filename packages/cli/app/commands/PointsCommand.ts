import { createAppRunner } from '@fougere/core';
import type { App, Plugged } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import pc from 'picocolors';
import { machineWanted, printMachine } from '../../src/machine.js';

type Ui = ReturnType<typeof createUi>;

const SHOWN = 8;

/**
 * Who answers, in the form the point gives them: a registry's names have no order, so they are a list;
 * a chain, a frond's middlewares and the extensions rising have one, outside in.
 */
function answered(one: Plugged): string {
  if (one.answers.length === 0) return pc.dim('nothing');
  const ordered = one.by === 'type' || one.point === 'extension';
  const shown = one.answers.slice(0, SHOWN).join(ordered ? pc.dim(' → ') : ', ');

  return one.answers.length > SHOWN ? `${shown} ${pc.dim(`… ${one.answers.length} in all`)}` : shown;
}

/** What plugs in where: the registries by name, then each frond's ports, seams, middlewares and steps. */
export default class PointsCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const points = (await createAppRunner(this.app)(
      { address: 'points', op: 'execute' },
      { params: {}, query: {}, input: raw, state: {} },
    )) as Plugged[];

    if (machineWanted(raw)) return printMachine(points);

    const line = (one: Plugged) => `${one.point}${one.subject ? ` ${pc.dim(one.subject)}` : ''}  ${pc.dim('·')}  ${answered(one)}`;
    const byName = points.filter((one) => one.by === 'name' && !one.frond);
    this.ui.note(byName.map(line).join('\n'), 'By name');

    const fronds = [...new Set(points.flatMap((one) => (one.frond ? [one.frond] : [])))];
    for (const frond of fronds) {
      this.ui.note(points.filter((one) => one.frond === frond).map(line).join('\n'), `Frond ${frond}`);
    }
  }
}
