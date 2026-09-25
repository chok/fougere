import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { diffLines } from 'diff';
import { addTemplate, addTypeTemplate, defineNuxtModule } from 'nuxt/kit';
import { codeToHtml } from 'shiki';

/**
 * `gestures/<tool>/<state>/` → `#build/gestures.mjs`, at build.
 *
 * One mini-app written in four tools, and three gestures applied to it. A page compares
 * what a gesture touched, file by file — so each file travels with its status and its
 * highlighted diff against the base state. The template holds the summaries and one dynamic
 * import per pair, so each pair is a chunk the page loads when a reader asks for it.
 */

const GESTURES = { field: 'g1-field', split: 'g2-split', engine: 'g3-postgres' } as const;
const TOOLS = ['fougere', 'zenstack', 'nestjs', 'encore'] as const;

type Gesture = keyof typeof GESTURES;
type Tool = (typeof TOOLS)[number];
type Status = 'added' | 'modified' | 'removed' | 'same';

export type GestureFile = {
  path: string;
  status: Status;
  generated: boolean;
  added: number;
  removed: number;
  html: string;
};

export type GestureSummary = { gesture: Gesture; tool: Tool; files: number; added: number; removed: number };

/** Shiki names, indexed by extension. ZModel is Prisma's grammar with a few words more. */
const LANGUAGE: Record<string, string> = {
  ts: 'ts',
  json: 'json',
  app: 'json',
  sql: 'sql',
  zmodel: 'prisma',
  toml: 'toml',
  yaml: 'yaml',
};

/** Written by the tool's own command, not by hand — shown, but said so. */
const GENERATED: Partial<Record<Tool, RegExp>> = {
  zenstack: /^zenstack\/migrations\//,
};

const THEMES = { default: 'github-light', dark: 'github-dark-default' };

const filesOf = async (root: string): Promise<Map<string, string>> => {
  const found = new Map<string, string>();
  const walk = async (directory: string) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await walk(path);
      else found.set(relative(root, path), await readFile(path, 'utf8'));
    }
  };
  await walk(root);

  return found;
};

/** The file as it ends up, with the lines the gesture removed kept in place and marked. */
const rendered = async (path: string, before: string | undefined, after: string | undefined) => {
  const kinds: string[] = [];
  const lines: string[] = [];
  let added = 0;
  let removed = 0;

  for (const part of diffLines(before ?? '', after ?? '')) {
    const partLines = part.value.replace(/\n$/, '').split('\n');
    const kind = part.added ? 'diff add' : part.removed ? 'diff remove' : '';
    const written = partLines.filter((line) => line.trim()).length;
    if (part.added) added += written;
    if (part.removed) removed += written;
    lines.push(...partLines);
    kinds.push(...partLines.map(() => kind));
  }

  const html = await codeToHtml(lines.join('\n'), {
    lang: LANGUAGE[extname(path).slice(1)] ?? 'text',
    themes: THEMES,
    defaultColor: false,
    transformers: [{
      line(node, line) {
        const kind = kinds[line - 1];
        if (kind) this.addClassToHast(node, kind);
      },
    }],
  });

  return { html, added, removed };
};

const statusOf = (before: string | undefined, after: string | undefined): Status =>
  before === undefined ? 'added' : after === undefined ? 'removed' : before === after ? 'same' : 'modified';

export default defineNuxtModule({
  meta: { name: 'gestures' },

  async setup(_options, nuxt) {
    const sources = join(nuxt.options.rootDir, 'gestures');
    let summaries: GestureSummary[] = [];
    const pairs = new Map<string, GestureFile[]>();

    const project = async () => {
      summaries = [];

      for (const tool of TOOLS) {
        const base = await filesOf(join(sources, tool, 'base'));
        for (const [gesture, state] of Object.entries(GESTURES) as [Gesture, string][]) {
          const after = await filesOf(join(sources, tool, state)).catch(() => undefined);
          if (!after) continue;

          const files: GestureFile[] = [];
          for (const path of [...new Set([...base.keys(), ...after.keys()])].sort()) {
            const status = statusOf(base.get(path), after.get(path));
            const { html, added, removed } = await rendered(path, base.get(path), after.get(path));
            files.push({ path, status, generated: GENERATED[tool]?.test(path) ?? false, added, removed, html });
          }

          const touched = files.filter((file) => file.status !== 'same' && !file.generated);
          summaries.push({
            gesture,
            tool,
            files: touched.length,
            added: touched.reduce((sum, file) => sum + file.added, 0),
            removed: touched.reduce((sum, file) => sum + file.removed, 0),
          });
          pairs.set(`${gesture}-${tool}`, files);
        }
      }

      return summaries.length;
    };

    console.info(`[gestures] ${await project()} gesture diffs projected into #build/gestures`);

    for (const pair of pairs.keys()) {
      addTemplate({ filename: `gestures/${pair}.json`, getContents: () => JSON.stringify(pairs.get(pair)) });
    }
    addTemplate({
      filename: 'gestures.mjs',
      getContents: () => [
        `export const summaries = ${JSON.stringify(summaries)};`,
        'export const diffs = {',
        ...[...pairs.keys()].map((pair) =>
          `  '${pair}': () => import('#build/gestures/${pair}.json').then((module) => module.default),`),
        '};',
      ].join('\n'),
    });

    addTypeTemplate({
      filename: 'types/gestures.d.ts',
      getContents: () => [
        "declare module '#build/gestures.mjs' {",
        `  import type { GestureFile, GestureSummary } from '${join(nuxt.options.rootDir, 'modules', 'gestures')}';`,
        '  export const summaries: GestureSummary[];',
        '  export const diffs: Record<string, () => Promise<GestureFile[]>>;',
        '}',
      ].join('\n'),
    });

    nuxt.hook('builder:watch', async (_event, path) => {
      if (path.startsWith('gestures/')) await project();
    });
  },
});
