import { createAppRunner } from '@fougere/core';
import type { App, CallPage, CallRecord } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import { machineWanted, printMachine } from '../../src/machine.js';
import pc from 'picocolors';

type Ui = ReturnType<typeof createUi>;

/** How long between two reads. Fast enough to read as a stream, cheap enough to ignore. */
const EVERY_MS = 500;

const ROUTE = { local: pc.green, remote: pc.cyan, system: pc.magenta } as const;

/**
 * `fougere devtools` — the call log of a running app, followed.
 *
 * A page at a time, from a cursor: this asks for what it has not seen, so a reader that
 * was away misses nothing except what the ring dropped — which the page states.
 */
export default class DevtoolsCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    if (machineWanted(raw)) return printMachine(await this.page(raw, Number(raw.since ?? 0)));

    const url = String(raw.url ?? 'http://127.0.0.1:3000');
    this.ui.step(`following ${pc.bold(url)} — ${pc.dim('ctrl-c to stop')}`);

    let cursor = Number(raw.since ?? 0);
    let told = 0;

    for (;;) {
      const page = await this.page(raw, cursor).catch((err: unknown) => {
        this.ui.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      });

      cursor = page.cursor;
      for (const call of page.calls) process.stdout.write(render(call) + '\n');

      // Said once, and only when it changes: a ring that dropped is not a quiet period.
      if (page.dropped > told) {
        this.ui.warn(`${page.dropped - told} call(s) dropped — the ring is smaller than this traffic`);
        told = page.dropped;
      }

      await new Promise((wake) => setTimeout(wake, EVERY_MS));
    }
  }

  private page(raw: Record<string, unknown>, since: number): Promise<CallPage> {
    return createAppRunner(this.app)(
      { entity: 'devtools', op: 'execute' },
      { params: {}, query: {}, body: { ...raw, since }, state: {} },
    ) as Promise<CallPage>;
  }
}

function render(call: CallRecord): string {
  const route = call.route ? (ROUTE[call.route] ?? pc.dim)(call.route) : pc.red('unrouted');
  const verdict = call.verdict === 'failed'
    ? pc.red(call.refusal?.code ?? 'failed')
    : call.verdict === 'ok' ? pc.dim('ok') : pc.yellow('running');
  const took = call.ms === undefined ? '' : pc.dim(`${call.ms}ms`);

  return [
    pc.dim(String(call.seq).padStart(4)),
    call.frond ? pc.dim(call.frond) : pc.dim('—'),
    pc.bold(`${call.entity}.${call.operation}`),
    call.surface ? pc.dim(`/${call.surface}`) : '',
    route,
    took,
    verdict,
  ].filter(Boolean).join('  ');
}
