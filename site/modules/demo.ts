import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { defineNuxtModule } from 'nuxt/kit';

/**
 * `demos/*` → `content/demo/<name>.md` + `public/demo/<name>.json`, at build.
 *
 * A page states `::demo{name="nuxt-blog"}` and holds no copy of what it shows, so the doc
 * cannot drift from the demo it presents. Generated rather than committed:
 * `render-diagrams.mjs` commits its SVG because D2 is an external tool the build should not
 * need, and reading files with `node:fs` is not one.
 *
 * The markdown feeds `::code-tree`, which derives its tree by splitting a block's label on
 * `/`. The JSON is the same files unhighlighted — what the sandbox button posts, fetched
 * only when a reader asks to run one.
 */

/** Shiki names, indexed by extension. What is absent ships as an unhighlighted block. */
const LANGUAGE: Record<string, string> = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  mjs: 'js',
  vue: 'vue',
  svelte: 'svelte',
  json: 'json',
  jsonc: 'jsonc',
  yaml: 'yaml',
  toml: 'toml',
  css: 'css',
  html: 'html',
  md: 'md',
  rs: 'rust',
};

/** Read by `nuxt.config.ts`, so the languages are declared once. */
export const DEMO_LANGUAGES = [...new Set(Object.values(LANGUAGE))];

type Demo = {
  name: string;
  files: { path: string; content: string }[];
  entry: string;
  runnable: boolean;
};

/** Tool output, not declaration — one Cargo.lock is 754 of rust-frond's 800 lines. */
const LOCKED = /(\.lock|-lock\.(yaml|json))$/;

const trackedFiles = (repository: string) =>
  execFileSync('git', ['ls-files', 'demos'], { cwd: repository, encoding: 'utf8' })
    .split('\n')
    .filter((path) => path && !LOCKED.test(path));

/**
 * A sandbox installs from the registry, so `workspace:*` resolves to nothing there. The
 * demo itself is untouched — only what leaves for the page says where its packages live.
 */
const published = (content: string, version: string) =>
  content.replace(/"workspace:\*"/g, `"^${version}"`);

/** Everything the tree shows, minus what nobody opens a project to read. */
const ASIDE = /^(package\.json|tsconfig.*\.json|CHANGELOG\.md|README\.md)$|\.lock$/;

const isCode = (path: string) => {
  const name = path.split('/').pop() ?? '';

  return LANGUAGE[extname(path).slice(1)] !== undefined
    && extname(path) !== '.md'
    && !name.startsWith('.')
    && !ASIDE.test(name);
};

const shallowest = (one: string, other: string) =>
  one.split('/').length - other.split('/').length || one.localeCompare(other);

/**
 * Derived, never declared: what a reader lands on when the tree opens. The declaration
 * comes first because it is what the whole site is about — a handler only answers for one.
 */
const entryOf = (paths: string[]): string => {
  const code = paths.filter(isCode).sort(shallowest);

  return code.find((path) => path === 'main.ts')
    ?? code.find((path) => /(^|\/)entit(y|ies)\//.test(path))
    ?? code.find((path) => /(^|\/)handlers?\//.test(path))
    ?? code.find((path) => path.endsWith('app.vue'))
    ?? code[0]
    ?? paths[0]
    ?? '';
};

/** Long enough to survive a file that contains a fence of its own — a README does. */
const fenceFor = (content: string) => {
  const longest = Math.max(0, ...[...content.matchAll(/`+/g)].map(([run]) => run.length));

  return '`'.repeat(Math.max(3, longest + 1));
};

const documentOf = ({ name, files, entry, runnable }: Demo) => {
  const blocks = files.map(({ path, content }) => {
    const fence = fenceFor(content);

    return `${fence}${LANGUAGE[extname(path).slice(1)] ?? ''} [${path}]\n${content}\n${fence}`;
  });

  const head = [
    '---',
    `title: ${JSON.stringify(name)}`,
    `name: ${JSON.stringify(name)}`,
    `entry: ${JSON.stringify(entry)}`,
    `runnable: ${runnable}`,
    `count: ${files.length}`,
    '---',
  ];

  return [...head, '', `::code-tree{default-value=${JSON.stringify(entry)}}`, ...blocks, '::', ''].join('\n');
};

const readDemos = async (repository: string, version: string): Promise<Demo[]> => {
  const byName = new Map<string, string[]>();

  for (const tracked of trackedFiles(repository)) {
    const [, name, ...rest] = tracked.split('/');
    if (!name || !rest.length) continue;

    byName.set(name, [...(byName.get(name) ?? []), rest.join('/')]);
  }

  return Promise.all(
    [...byName].map(async ([name, paths]) => {
      const files = await Promise.all(
        paths.sort().map(async (path) => {
          const raw = await readFile(join(repository, 'demos', name, path), 'utf8');

          return { path, content: path.endsWith('package.json') ? published(raw, version) : raw };
        }),
      );

      return {
        name,
        files,
        entry: entryOf(paths),
        runnable: !files.some((file) => file.content.includes('better-sqlite3')),
      };
    }),
  );
};

export default defineNuxtModule({
  meta: { name: 'demo' },

  async setup(_options, nuxt) {
    const repository = join(nuxt.options.rootDir, '..');
    const pages = join(nuxt.options.rootDir, 'content', 'demo');
    const sources = join(nuxt.options.rootDir, 'public', 'demo');

    const project = async () => {
      const { version } = JSON.parse(
        await readFile(join(repository, 'packages', 'core', 'package.json'), 'utf8'),
      );
      const demos = await readDemos(repository, version);

      await rm(pages, { recursive: true, force: true });
      await mkdir(pages, { recursive: true });
      await mkdir(sources, { recursive: true });

      for (const demo of demos) {
        await writeFile(join(pages, `${demo.name}.md`), documentOf(demo));
        await writeFile(
          join(sources, `${demo.name}.json`),
          JSON.stringify(Object.fromEntries(demo.files.map(({ path, content }) => [path, content]))),
        );
      }

      return demos.length;
    };

    const count = await project();
    console.info(`[demo] ${count} demos projected into content/demo`);

    nuxt.hook('builder:watch', async (_event, path) => {
      if (path.includes('demos/')) await project();
    });
  },
});
