import type { Readable, Writable } from 'node:stream';
import { stripVTControlCharacters } from 'node:util';
import { Prompt, isCancel } from '@clack/core';
import pc from 'picocolors';
import { type Catalog, type Kind, type Plan, commandOf, treeOf } from './Plan.js';

interface Row { kind: Kind; template: string; name: string; on: boolean }

type Step = 'project' | Kind;

const STEPS: Step[] = ['project', 'fronds', 'apps'];

const TITLE: Record<Step, string> = { project: 'Project', fronds: 'Fronds', apps: 'Apps' };

const QUESTION: Record<Step, string> = {
  project: 'Name',
  fronds: 'Which domains does it hold?',
  apps: 'What consumes them?',
};

const MEANING: Record<Step, string> = {
  project: 'Its directory and its package name.',
  fronds: 'A frond is a domain — its entities and the operations on them. It runs inside an app, or in a process of its own.',
  apps: 'An app is what people use — pages that call the fronds’ operations.',
};

const TYPED = /^[a-z0-9._-]$/;

const ERASE = new Set(['\x7f', '\b']);

const visible = (line: string): number => stripVTControlCharacters(line).length;

const padded = (line: string, width: number): string => line + ' '.repeat(Math.max(0, width - visible(line)));

export interface Composed { plan: Plan; overwrite: boolean }

export interface ComposerOptions {
  name: string;
  catalog: Catalog;
  exists: (name: string) => boolean;
  refusals: (plan: Plan, overwrite: boolean) => string[];
  input?: Readable;
  output?: Writable;
}

/**
 * `fougere new` in three steps — the project, its fronds, its apps — with the tree the plan
 * writes and the command that writes it with no prompt drawn beside every step.
 *
 * ⏎ moves on and ← goes back. In a list, `r` renames the row under the cursor and `+` adds another
 * piece of the same template. Nothing is written here: the answer is a `Plan`, and whether the
 * directory it names may be replaced.
 *
 * Documented: [the CLI](https://fougere.dev/docs/cli).
 */
export class Composer {
  static WIDTH = 36;

  private step: Step;
  private rows: Row[];
  private name: string;
  private cursor = 0;
  private editing: string | undefined;
  private asking = false;
  private overwrite = false;
  private held = false;
  private prompt: Prompt;
  private output: Writable;

  constructor(private options: ComposerOptions) {
    this.name = options.name;
    this.rows = (['fronds', 'apps'] as const).flatMap((kind) =>
      options.catalog[kind].map((template) => ({ kind, template, name: template, on: false })));
    this.step = 'project';
    this.editing = options.name;
    this.output = options.output ?? process.stdout;
    this.prompt = new Prompt({
      render: () => this.frame(),
      validate: () => this.refusal(),
      input: options.input,
      output: options.output,
    }, false);
    this.prompt.value = '';
    this.prompt.on('cursor', (action) => this.act(action));
    this.prompt.on('key', (char) => this.type(char ?? ''));
    this.prompt.on('finalize', () => { this.prompt.value = { plan: this.plan(), overwrite: this.overwrite }; });
  }

  /** What the screen was left on, or `undefined` when it was cancelled. */
  async ask(): Promise<Composed | undefined> {
    const answer = await this.prompt.prompt();

    return isCancel(answer) ? undefined : answer as unknown as Composed;
  }

  plan(): Plan {
    const pieces = (kind: Kind) =>
      this.rows.filter((row) => row.kind === kind && row.on).map(({ template, name }) => ({ template, name }));

    return { name: this.name, fronds: pieces('fronds'), apps: pieces('apps') };
  }

  frame(columns = (this.output as { columns?: number }).columns || 80): string {
    const plan = this.plan();
    const bar = pc.gray('│');
    if (this.prompt.state === 'submit') {
      return `${pc.green('◇')}  ${plan.name} ${pc.dim('— ' + summaryOf(plan) + (this.overwrite ? ', replacing what was there' : ''))}`;
    }
    if (this.prompt.state === 'cancel') return `${pc.red('■')}  ${pc.dim('Cancelled — nothing was written.')}`;

    const left = this.body();
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
      `${bar}  ${this.breadcrumb()}`,
      bar,
      `${bar}  ${pc.bold(QUESTION[this.step])}`,
      `${bar}  ${pc.dim(MEANING[this.step])}`,
      bar,
      ...body.map((line) => `${bar}  ${line}`),
      bar,
      `${bar}  ${pc.dim('Same, with no prompt:')} ${commandOf(plan)}`,
      ...(refusal ? [`${bar}  ${pc.yellow(refusal)}`] : []),
      `${pc.gray('└')}  ${pc.dim(this.hint())}`,
    ].join('\n');
  }

  private breadcrumb(): string {
    const reached = STEPS.indexOf(this.step);

    return STEPS.map((step, at) => {
      if (at === reached) return pc.cyan(pc.bold(`● ${TITLE[step]}`));

      return at < reached ? pc.green(`✓ ${TITLE[step]}`) : pc.dim(`○ ${TITLE[step]}`);
    }).join(pc.dim('  ›  '));
  }

  private body(): string[] {
    if (this.step === 'project') {
      const name = this.editing === undefined ? this.name : pc.underline(this.editing) + pc.cyan('▌');
      const lines = [`${pc.cyan('▸')} ${name || pc.dim('<name>')}`];

      return this.asking ? [...lines, '', pc.yellow(`${this.name}/ already exists.`), `Replace it? ${pc.dim('y / n')}`] : lines;
    }

    return this.listed().map(({ row, at }) => {
      const pointer = at === this.cursor ? pc.cyan('▸') : ' ';
      const box = row.on ? pc.green('◼') : pc.dim('◻');
      const name = at === this.cursor && this.editing !== undefined ? pc.underline(this.editing) + pc.cyan('▌') : row.name;
      const renamed = row.name === row.template ? '' : pc.dim(` (${row.template})`);

      return `${pointer} ${box} ${name}${renamed}`;
    });
  }

  private hint(): string {
    if (this.asking) return 'y replace · n pick another name · esc quit';
    if (this.editing !== undefined) return this.step === 'project' ? 'type the name · ⏎ next · esc quit' : 'type the name · ⏎ keep it · esc quit';

    const next = this.step === 'apps' ? '⏎ write' : '⏎ next';

    return `↑↓ move · space check · + another · r rename · ← back · ${next} · esc quit`;
  }

  /** The rows of the current step, each with its index among them. */
  private listed(): { row: Row; at: number }[] {
    return this.rows.filter((row) => row.kind === this.step).map((row, at) => ({ row, at }));
  }

  private current(): Row | undefined {
    return this.listed()[this.cursor]?.row;
  }

  private go(step: Step): void {
    this.step = step;
    this.cursor = 0;
    this.editing = step === 'project' ? this.name : undefined;
  }

  private act(action: string | undefined): void {
    if (this.editing !== undefined || this.asking) return;

    const last = this.listed().length - 1;
    if (action === 'up') this.cursor = this.cursor === 0 ? last : this.cursor - 1;
    if (action === 'down') this.cursor = this.cursor === last ? 0 : this.cursor + 1;
    if (action === 'left') this.go(STEPS[STEPS.indexOf(this.step) - 1] ?? 'project');
    if (action === 'space') {
      const row = this.current();
      if (row) row.on = !row.on;
    }
  }

  private type(char: string): void {
    if (this.asking) return this.answer(char);
    if (this.editing !== undefined) return this.edit(char);
    if (char === '\r' && this.step !== 'apps') return this.hold(() => this.go(STEPS[STEPS.indexOf(this.step) + 1]));
    if (char === 'r') this.editing = this.current()?.name;
    if (char === '+') this.another();
  }

  private edit(char: string): void {
    const editing = this.editing ?? '';
    if (ERASE.has(char)) this.editing = editing.slice(0, -1);
    else if (TYPED.test(char)) this.editing = editing + char;
    if (char !== '\r') return;

    if (this.step === 'project') return this.hold(() => this.named(editing));

    this.editing = undefined;
    const row = this.current();
    this.hold(() => { if (editing && row) row.name = editing; });
  }

  /** The name is kept, and the step left, only once it can be written. */
  private named(name: string): void {
    this.name = name;
    this.overwrite = false;
    if (this.options.refusals({ name, fronds: [], apps: [] }, true).length) return;

    this.editing = undefined;
    if (this.options.exists(name)) this.asking = true;
    else this.go('fronds');
  }

  private answer(char: string): void {
    if (char === 'y') {
      this.overwrite = true;
      this.asking = false;
      this.go('fronds');
    }
    if (char === 'n') {
      this.asking = false;
      this.editing = this.name;
    }
    if (char === '\r') this.held = true;
  }

  private another(): void {
    const row = this.current();
    if (!row) return;

    const taken = new Set(this.rows.filter((other) => other.kind === row.kind).map((other) => other.name));
    let count = 2;
    while (taken.has(`${row.template}-${count}`)) count++;
    this.rows.splice(this.rows.indexOf(row) + 1, 0, { ...row, name: `${row.template}-${count}`, on: true });
    this.cursor++;
    this.editing = this.current()?.name;
  }

  /** ⏎ that moves the screen on is not the ⏎ that writes: the next one is. */
  private hold(move: () => void): void {
    this.held = true;
    move();
  }

  private refusal(): string | undefined {
    if (this.step === 'project' && !this.asking) {
      const refused = this.options.refusals({ name: this.name, fronds: [], apps: [] }, true)[0];
      if (refused) {
        this.held = false;

        return refused;
      }
    }
    if (this.held) {
      this.held = false;

      return ' ';
    }

    return this.options.refusals(this.plan(), this.overwrite)[0];
  }
}

function summaryOf(plan: Plan): string {
  const names = (kind: Kind) => plan[kind].map((piece) => piece.name).join(', ');
  const parts = (['fronds', 'apps'] as const).filter((kind) => plan[kind].length).map((kind) => `${kind}: ${names(kind)}`);

  return parts.join(' · ') || 'an empty workspace';
}
