import type { Readable, Writable } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';
import { Prompt, isCancel } from '@clack/core';
import pc from 'picocolors';
import { type Catalog, type Kind, type Plan, commandOf, treeOf } from './Plan.js';

interface Row { kind: Kind; template: string; name: string; on: boolean }

const TITLE: Record<Kind, string> = { fronds: 'Fronds — your domains', apps: 'Apps — what consumes them' };

const TYPED = /^[a-z0-9._-]$/;

const ERASE = new Set(['\x7f', '\b']);

const visible = (line: string): number => stripVTControlCharacters(line).length;

const padded = (line: string, width: number): string => line + ' '.repeat(Math.max(0, width - visible(line)));

/**
 * `fougere new` on one screen: the project, the pieces to check, and — beside them — the tree
 * the plan writes and the command that writes it with no prompt, both redrawn at every key.
 *
 * Row 0 is the project's name. `r` renames the row under the cursor, `+` adds another piece of
 * the same template and names it. Nothing is written here: the answer is a `Plan`.
 *
 * Documented: [the CLI](https://fougere.dev/docs/cli).
 */
export class Composer {
  static WIDTH = 36;

  private rows: Row[];
  private name: string;
  private cursor = 0;
  private editing: string | undefined;
  private held = false;
  private prompt: Prompt;
  private output: Writable;

  constructor(
    name: string,
    catalog: Catalog,
    private refusals: (plan: Plan) => string[],
    io: { input?: Readable; output?: Writable } = {},
  ) {
    this.name = name;
    this.rows = (['fronds', 'apps'] as const).flatMap((kind) =>
      catalog[kind].map((template) => ({ kind, template, name: template, on: false })));
    if (!name) this.editing = '';
    this.output = io.output ?? process.stdout;
    this.prompt = new Prompt({
      render: () => this.frame(),
      validate: () => this.refusal(),
      ...io,
    }, false);
    this.prompt.value = '';
    this.prompt.on('cursor', (action) => this.act(action));
    this.prompt.on('key', (char) => this.type(char ?? ''));
    this.prompt.on('finalize', () => { this.prompt.value = this.plan(); });
  }

  /** The plan the screen was left on, or `undefined` when it was cancelled. */
  async ask(): Promise<Plan | undefined> {
    const answer = await this.prompt.prompt();

    return isCancel(answer) ? undefined : answer as unknown as Plan;
  }

  plan(): Plan {
    const pieces = (kind: Kind) =>
      this.rows.filter((row) => row.kind === kind && row.on).map(({ template, name }) => ({ template, name }));

    return { name: this.name, fronds: pieces('fronds'), apps: pieces('apps') };
  }

  frame(columns = (this.output as { columns?: number }).columns || 80): string {
    const plan = this.plan();
    const bar = pc.gray('│');
    if (this.prompt.state === 'submit') return `${pc.green('◇')}  ${plan.name} ${pc.dim('— ' + summaryOf(plan))}`;
    if (this.prompt.state === 'cancel') return `${pc.red('■')}  ${pc.dim('Cancelled — nothing was written.')}`;

    const left = this.left();
    const right = treeOf(plan).map((line) => pc.dim(line));
    const side = columns >= Composer.WIDTH + Math.max(...right.map(visible)) + 6;
    const body = side
      ? Array.from({ length: Math.max(left.length, right.length) },
        (_, at) => (padded(left[at] ?? '', Composer.WIDTH) + (right[at] ?? '')).trimEnd())
      : [...left, '', ...right];
    const refusal = this.prompt.state === 'error' ? this.prompt.error.trim() : '';

    return [
      `${pc.cyan('◆')}  ${pc.bold('New Fougere project')}`,
      bar,
      ...body.map((line) => `${bar}  ${line}`),
      bar,
      `${bar}  ${pc.dim('Same, with no prompt:')} ${commandOf(plan)}`,
      ...(refusal ? [`${bar}  ${pc.yellow(refusal)}`] : []),
      `${pc.gray('└')}  ${pc.dim(this.editing === undefined
        ? '↑↓ move · space check · + another · r rename · ⏎ write · esc quit'
        : 'type the name · ⏎ keep it · esc quit')}`,
    ].join('\n');
  }

  private left(): string[] {
    const pointer = (at: number) => (at === this.cursor ? pc.cyan('▸') : ' ');
    const named = (at: number, name: string) =>
      at === this.cursor && this.editing !== undefined ? pc.underline(this.editing) + pc.cyan('▌') : name;
    const lines = [`${pointer(0)} ${pc.dim('Project')} ${pc.bold(named(0, this.name || pc.dim('<name>')))}`];
    for (const kind of ['fronds', 'apps'] as const) {
      lines.push('', pc.dim(TITLE[kind]));
      this.rows.forEach((row, index) => {
        if (row.kind !== kind) return;

        const at = index + 1;
        const box = row.on ? pc.green('◼') : pc.dim('◻');
        const renamed = row.name === row.template ? '' : pc.dim(` (${row.template})`);
        lines.push(`${pointer(at)} ${box} ${named(at, row.name)}${renamed}`);
      });
    }

    return lines;
  }

  private act(action: string | undefined): void {
    if (this.editing !== undefined) return;

    const last = this.rows.length;
    if (action === 'up') this.cursor = this.cursor === 0 ? last : this.cursor - 1;
    if (action === 'down') this.cursor = this.cursor === last ? 0 : this.cursor + 1;
    if (action !== 'space') return;

    const row = this.rows[this.cursor - 1];
    if (row) row.on = !row.on;
    else this.editing = this.name;
  }

  private type(char: string): void {
    if (this.editing === undefined) {
      if (char === 'r') this.editing = this.cursor === 0 ? this.name : this.rows[this.cursor - 1].name;
      if (char === '+' && this.cursor > 0) this.another();

      return;
    }
    if (char === '\r') return this.keep();
    if (ERASE.has(char)) this.editing = this.editing.slice(0, -1);
    else if (TYPED.test(char)) this.editing += char;
  }

  private another(): void {
    const row = this.rows[this.cursor - 1];
    const taken = new Set(this.rows.filter((other) => other.kind === row.kind).map((other) => other.name));
    let count = 2;
    while (taken.has(`${row.template}-${count}`)) count++;
    this.rows.splice(this.cursor, 0, { ...row, name: `${row.template}-${count}`, on: true });
    this.cursor++;
    this.editing = this.rows[this.cursor - 1].name;
  }

  /** ⏎ while naming keeps the name and holds the plan: the next ⏎ is the one that writes. */
  private keep(): void {
    const name = this.editing;
    this.editing = undefined;
    this.held = true;
    if (!name) return;

    if (this.cursor === 0) this.name = name;
    else this.rows[this.cursor - 1].name = name;
  }

  private refusal(): string | undefined {
    if (this.held) {
      this.held = false;

      return ' ';
    }

    return this.refusals(this.plan())[0];
  }
}

function summaryOf(plan: Plan): string {
  const names = (kind: Kind) => plan[kind].map((piece) => piece.name).join(', ');
  const parts = (['fronds', 'apps'] as const).filter((kind) => plan[kind].length).map((kind) => `${kind}: ${names(kind)}`);

  return parts.join(' · ') || 'an empty workspace';
}
