import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { defineNuxtModule } from 'nuxt/kit';

/**
 * `demos/tutorial/steps/*` → `content/tutorial/<step>.md`, at build — the sibling of `demo.ts`.
 *
 * A step is a whole project and a `STEP.json` saying what it grew. What the page shows of it is
 * computed here against the step before: which files are new, changed or moved, which lines were
 * added, the line each letter points at, and the "0 line changed" stamp. Nothing on the page is a
 * copy of the code, and `demos/tutorial/tests` checks every claim the JSON makes.
 */

interface Grows { side: string; label: string; detail: string; from: { file: string; line: string } }
interface Step {
  name: string; title: string; concept: string; lede: string; fig: string;
  grows: Grows[];
  try: { command: string; output: string };
  whatIf?: string;
  links: { title: string; path: string }[];
}

const LETTERS = 'abcdefghij';

/** What a reader opens: the project's own files, not the tooling around them. */
const shown = (path: string) =>
  path !== 'STEP.json' && !path.endsWith('tsconfig.json') && !path.split('/').some((part) => part.startsWith('.'));

async function filesOf(root: string): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  const walk = async (here: string) => {
    for (const name of (await readdir(here)).sort()) {
      const path = join(here, name);
      if ((await stat(path)).isDirectory()) await walk(path);
      else if (shown(relative(root, path))) files.set(relative(root, path), await readFile(path, 'utf8'));
    }
  };
  await walk(root);

  return files;
}

/** The lines of `after` absent from `before`, by longest common subsequence — files here are short. */
function addedLines(before: string[], after: string[]): Set<number> {
  const table = before.map(() => after.map(() => 0));
  const at = (i: number, j: number) => (i < before.length && j < after.length ? table[i]![j]! : 0);
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i]![j] = before[i] === after[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  const added = new Set<number>();
  let i = 0;
  let j = 0;
  while (j < after.length) {
    if (i < before.length && before[i] === after[j]) {
      i++;
      j++;
    } else if (i < before.length && at(i + 1, j) >= at(i, j + 1)) {
      i++;
    } else {
      added.add(j++);
    }
  }

  return added;
}

const linesOf = (text: string) => text.replace(/\n$/, '').split('\n');

/** The order a reader meets a project in: what a thing is, what it does, then how it runs. */
const RANK = ['/entities/', '/handlers/', '/services/', 'fougere.config.ts'];
const rank = (path: string) => RANK.findIndex((part) => path.includes(part));
const byReading = (one: string, other: string) => rank(one) - rank(other) || one.localeCompare(other);

function pageOf(index: number, slug: string, step: Step, files: Map<string, string>, previous: Map<string, string>) {
  const gone = [...previous.keys()].filter((path) => !files.has(path));
  const stateOf = (path: string) => {
    if (index === 0) return 'new';
    if (!previous.has(path)) {
      const name = path.split('/').pop();
      return gone.some((old) => old.split('/').pop() === name) ? 'moved' : 'new';
    }
    return previous.get(path) === files.get(path) ? '' : 'changed';
  };

  // Lettered in the order the page lists them — incoming, outgoing, refused — so a, b, c read down.
  const SIDES = ['in', 'out', 'refuses'];
  const keys = [...step.grows]
    .sort((one, other) => SIDES.indexOf(one.side) - SIDES.indexOf(other.side))
    .map((grows, k) => ({ ...grows, key: LETTERS[k]! }));
  const touched = [...files.keys()].filter((path) => stateOf(path) === 'new' || stateOf(path) === 'changed');
  const code = touched.sort(byReading).map((path) => {
    const lines = linesOf(files.get(path)!);
    const added = index === 0 || !previous.has(path) ? new Set<number>() : addedLines(linesOf(previous.get(path)!), lines);
    const pointed = new Map<number, string[]>();
    for (const grows of keys.filter((one) => one.from.file === path)) {
      const at = lines.findIndex((line) => line.includes(grows.from.line));
      pointed.set(at, [...(pointed.get(at) ?? []), grows.key]);
    }

    return { path, lines: lines.map((text, at) => ({ text, added: added.has(at), keys: pointed.get(at) ?? [] })) };
  });

  const changedUnder = (prefix: RegExp) => index > 0 && [...files.keys(), ...gone].some((path) =>
    prefix.test(path) && previous.get(path) !== files.get(path));
  const zero = index === 0 ? undefined
    : !changedUnder(/^fronds\//) ? 'fronds/'
      : !changedUnder(/^fronds\/[^/]+\/handlers\//) ? 'handlers/' : undefined;

  const data = {
    title: step.title.replace(/\*/g, ''),
    description: step.lede,
    step: index,
    name: step.name,
    concept: step.concept,
    lede: step.lede,
    fig: step.fig,
    heading: step.title,
    files: [...files.keys()].sort(byReading).map((path) => ({ path, state: stateOf(path) })),
    code,
    grows: keys.map(({ key, side, label, detail }) => ({ key, side, label, detail })),
    tryIt: { command: step.try.command, output: step.try.output },
    ...(step.whatIf ? { whatIf: step.whatIf } : {}),
    ...(zero ? { zero } : {}),
    links: step.links,
    slug,
  };
  const head = Object.entries(data).map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

  return ['---', ...head, '---', ''].join('\n');
}

export default defineNuxtModule({
  meta: { name: 'tutorial' },
  async setup(_options, nuxt) {
    const steps = join(nuxt.options.rootDir, '..', 'demos', 'tutorial', 'steps');
    const pages = join(nuxt.options.rootDir, 'content', 'tutorial');

    const project = async () => {
      const names = (await readdir(steps)).filter((name) => !name.startsWith('.')).sort();
      await rm(pages, { recursive: true, force: true });
      await mkdir(pages, { recursive: true });
      let previous = new Map<string, string>();
      for (const [index, name] of names.entries()) {
        const root = join(steps, name);
        const step = JSON.parse(await readFile(join(root, 'STEP.json'), 'utf8')) as Step;
        const files = await filesOf(root);
        await writeFile(join(pages, `${name}.md`), pageOf(index, name, step, files, previous));
        previous = files;
      }

      return names.length;
    };

    console.info(`[tutorial] ${await project()} steps projected into content/tutorial`);
    nuxt.hook('builder:watch', async (_event, path) => {
      if (path.includes('demos/tutorial/')) await project();
    });
  },
});
