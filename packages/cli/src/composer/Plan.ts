import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type Kind = 'fronds' | 'apps';

export interface Piece { template: string; name: string }

/**
 * What `fougere new` writes, whoever composed it: the flags state it, the composer builds it,
 * and one writer carries it out once nothing is left to ask.
 */
export interface Plan { name: string; fronds: Piece[]; apps: Piece[] }

export interface Catalog { fronds: string[]; apps: string[] }

export interface Stated { name?: string; frond?: string; app?: string; bare?: boolean }

const FLAG: Record<Kind, string> = { fronds: '--frond', apps: '--app' };

const PROJECT = /^[a-z0-9][a-z0-9._-]*$/;

const PIECE = /^[a-z][a-z0-9-]*$/;

/** The flags, read as a plan — or `undefined` when they state no composition and the composer should ask. */
export function planOf(stated: Stated): Plan | undefined {
  if (!stated.bare && !stated.frond && !stated.app) return undefined;

  return {
    name: stated.name ?? '',
    fronds: piecesOf(stated.frond ?? ''),
    apps: piecesOf(stated.app ?? ''),
  };
}

function piecesOf(spec: string): Piece[] {
  return spec.split(',').map((piece) => piece.trim()).filter(Boolean).map((piece) => {
    const [template, name = template, ...rest] = piece.split(':');
    if (rest.length) throw new Error(`'${piece}' is a template and a name, 'blog:news' — one colon at most.`);

    return { template, name };
  });
}

/** The dual of `planOf`: the line that writes this plan again, with no prompt. */
export function commandOf(plan: Plan, entry = 'pnpm create fougere'): string {
  const spec = (pieces: Piece[]) =>
    pieces.map(({ template, name }) => (name === template ? template : `${template}:${name}`)).join(',');
  const flags = (['fronds', 'apps'] as const)
    .filter((kind) => plan[kind].length)
    .map((kind) => `${FLAG[kind]} ${spec(plan[kind])}`);

  return [entry, plan.name || '<name>', ...(flags.length ? flags : ['--bare'])].join(' ');
}

/** The directories the plan writes, drawn as a tree. */
export function treeOf(plan: Plan): string[] {
  const kinds = (['fronds', 'apps'] as const).filter((kind) => plan[kind].length);
  const top = ['fougere.config.ts', 'package.json', ...kinds.map((kind) => `${kind}/`)];
  const lines = [`${plan.name || '<name>'}/`];
  top.forEach((entry, index) => {
    const last = index === top.length - 1;
    lines.push(`${last ? '└─' : '├─'} ${entry}`);
    const kind = kinds.find((candidate) => `${candidate}/` === entry);
    if (!kind) return;

    plan[kind].forEach((piece, at) =>
      lines.push(`${last ? '   ' : '│  '}${at === plan[kind].length - 1 ? '└─' : '├─'} ${piece.name}/`));
  });

  return lines;
}

/** Everything that stops the plan from being written, in the order a reader fixes it. */
export function refusalsOf(plan: Plan, catalog: Catalog, where: { cwd: string; replace?: boolean }): string[] {
  const refusals: string[] = [];
  if (!plan.name) refusals.push('The project has no name — fougere new <name>.');
  else if (!PROJECT.test(plan.name)) refusals.push(`'${plan.name}' is not a package name: lowercase letters, digits, '.', '_' and '-'.`);
  else if (existsSync(join(where.cwd, plan.name)) && !where.replace) refusals.push(`${plan.name}/ already exists — pick another name, or pass --force to replace it.`);

  for (const kind of ['fronds', 'apps'] as const) {
    const seen = new Set<string>();
    for (const { template, name } of plan[kind]) {
      if (!catalog[kind].includes(template)) refusals.push(`No ${kind} template '${template}' — available: ${catalog[kind].join(', ') || '(none)'}.`);
      if (!PIECE.test(name)) refusals.push(`'${name}' is not a ${kind === 'fronds' ? 'frond' : 'app'} name: a lowercase letter, then letters, digits and '-'.`);
      if (seen.has(name)) refusals.push(`Two ${kind} are called '${name}' — rename one.`);
      seen.add(name);
    }
  }

  return refusals;
}
