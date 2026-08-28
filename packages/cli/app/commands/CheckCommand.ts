import type { CheckResult, Finding } from '../../fronds/analysis/handlers/CheckHandler.js';
import type { App } from '@fougere/core';
import { createAppRunner } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import pc from 'picocolors';
import { relative } from 'node:path';
import { machineWanted, printMachine } from '../../src/machine.js';

type Ui = ReturnType<typeof createUi>;

export default class CheckCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    // Ride the call contract — the same envelope every consumer uses.
    const result = await createAppRunner(this.app)(
      { entity: 'check', op: 'execute' },
      { params: {}, query: {}, body: raw, state: {} },
    ) as CheckResult;

    // A non-zero exit is what makes this usable in CI, so it is decided before the two
    // renderings rather than inside the terminal one.
    const blocking = result.findings.filter((f) => f.severity === 'blocking').length;
    if (blocking > 0) process.exitCode = 1;

    if (machineWanted(raw)) return printMachine(result);

    if (result.fronds === 0) {
      this.ui.warn('No fronds found. Run this from a Fougere project root.');
      return;
    }

    this.ui.step(`${pc.bold(String(result.fronds))} frond(s), ${pc.bold(String(result.handlers))} handler(s)`);

    if (result.findings.length === 0) {
      this.ui.success('Nothing to report.');
      return;
    }

    this.ui.note(result.findings.map(render).join('\n\n'), 'Findings');

    // Warnings do not fail: an unresolvable base class with no operation is ordinary,
    // and a check that cries wolf stops being read.
    this.ui.info(`${blocking} blocking, ${result.findings.length - blocking} warning(s)`);
  }
}

function render(f: Finding): string {
  const mark = f.severity === 'blocking' ? pc.red('✗') : pc.yellow('⚠');
  const where = relative(process.cwd(), f.filePath) || f.filePath;
  const what = f.subject ? ` ${f.subject}` : '';
  return `  ${mark} ${pc.bold(`[${f.code}]`)}${what}\n${wrap(f.message, 76, '    ')}\n    ${pc.dim(where)}`;
}

/** A box grows to its longest line, so a one-line sentence makes an unreadable box. */
function wrap(text: string, width: number, indent: string): string {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    if (line && line.length + 1 + word.length > width) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines.map((l) => indent + l).join('\n');
}
