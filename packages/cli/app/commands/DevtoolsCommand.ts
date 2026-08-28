import { createAppRunner } from '@fougere/core';
import type { App, CallRecord } from '@fougere/core';
import type { CallsView } from '../../fronds/analysis/handlers/DevtoolsHandler.js';
import type { ui as createUi } from '../../src/ui.js';
import { machineWanted, printMachine } from '../../src/machine.js';
import pc from 'picocolors';

type Ui = ReturnType<typeof createUi>;

/** How long between two reads. Fast enough to read as a stream, cheap enough to ignore. */
const EVERY_MS = 500;

const ROUTE = { local: pc.green, remote: pc.cyan, system: pc.magenta } as const;

/**
 * `fougere devtools` — the call log of every running app of this project, followed.
 *
 * A cursor per address, because each app numbers its own ring: asking for what this reader
 * has not seen is the whole protocol, and it is per source or nothing.
 */
export default class DevtoolsCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const since: Record<string, number> = {};

    if (machineWanted(raw)) return printMachine(await this.view(raw, since));

    const first = await this.view(raw, since);
    this.announce(first);

    const told: Record<string, number> = {};
    for (let view = first; ; view = await this.view(raw, since)) {
      for (const source of view.sources) {
        since[source.url] = source.cursor;

        // Said once per address, and only when it grows: a ring that dropped is not a
        // quiet period, and repeating it every half second would bury the calls.
        if (source.dropped > (told[source.url] ?? 0)) {
          this.ui.warn(`${source.url} dropped ${source.dropped - (told[source.url] ?? 0)} call(s) — its ring is smaller than this traffic`);
          told[source.url] = source.dropped;
        }
      }

      for (const call of view.calls) process.stdout.write(render(call, view.sources.length > 1) + '\n');
      await new Promise((wake) => setTimeout(wake, EVERY_MS));
    }
  }

  /** What is being watched, and what refused — stated before the first line scrolls. */
  private announce(view: CallsView): void {
    for (const source of view.sources) {
      const name = source.frond ? `${pc.bold(source.frond)} ${pc.dim(source.url)}` : pc.bold(source.url);
      if (source.refusal) this.ui.warn(`${name} — ${source.refusal}`);
      else this.ui.step(`following ${name}`);
    }
    this.ui.info(pc.dim('ctrl-c to stop'));
  }

  private view(raw: Record<string, unknown>, since: Record<string, number>): Promise<CallsView> {
    return createAppRunner(this.app)(
      { entity: 'devtools', op: 'execute' },
      { params: {}, query: {}, body: { ...raw, since }, state: {} },
    ) as Promise<CallsView>;
  }
}

function render(call: CallRecord & { source: string }, many: boolean): string {
  // Padded BEFORE colouring: an escape sequence counts in a string's length, so padding a
  // coloured value moves the column by however many bytes the colour took.
  const at = many ? pc.dim(pad(new URL(call.source).port || call.source, 5)) : '';
  const frond = pc.dim(pad(call.frond ?? '—', 9));
  const address = pc.bold(pad(`${call.entity}.${call.operation}${call.surface ? `/${call.surface}` : ''}`, 22));
  const route = call.route
    ? (ROUTE[call.route] ?? pc.dim)(pad(call.route, 9))
    : pc.red(pad('unrouted', 9));
  const took = pc.dim(lead(call.ms === undefined ? '' : `${call.ms}ms`, 7));
  const verdict = call.verdict === 'failed'
    ? pc.red(call.refusal?.code ?? 'failed')
    : call.verdict === 'ok' ? pc.dim('ok') : pc.yellow('running');

  return [at, frond, address, route, took, verdict, call.trace ? pc.dim(call.trace.slice(3, 11)) : '']
    .filter(Boolean).join(' ');
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + ' '.repeat(width - value.length);
}

function lead(value: string, width: number): string {
  return value.length >= width ? value : ' '.repeat(width - value.length) + value;
}
