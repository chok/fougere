import type { KnipConfig } from 'knip';
import { DEFAULT_CONVENTIONS, frondDirsOf } from './packages/core/src/scan/conventions.js';

/**
 * Frond files are loaded by convention rather than imports. Derive their entry globs
 * from the same convention as the scanner so Knip does not report them as dead.
 */
const frondEntry = (prefix: string): string[] =>
  frondDirsOf(DEFAULT_CONVENTIONS).map((dir) => `${prefix}${dir}/**/*.ts`);

const entry = [
  // A frond under `fronds/`, and the root frond — the root IS a frond.
  ...frondEntry('fronds/*/'),
  ...frondEntry(''),
  // The topology statement, and a frond's own overrides.
  'fougere.config.ts',
  'fronds/*/frond.config.ts',
  // knip's defaults, which naming `entry` would otherwise replace.
  'src/index.ts',
  'index.ts',
];

const config: KnipConfig = {
  /**
   * `files` is deliberately absent, and it is the one verdict knip cannot reach
   * here. Teaching it the convention takes a glob per workspace shape — a second
   * copy of `pnpm-workspace.yaml` after the copy of `FROND_DIRS` above — and it
   * would still be a reachability analysis guessing at a runtime scan. The question
   * "which files does this app actually load?" already has an exact answer:
   * `scanProject()` returns it. A reader that asks the scan is worth building; a
   * config that imitates it is not.
   *
   * What remains is what knip judges from declarations, which is sound whatever
   * loads the file — and it is the half that bears on publishing.
   */
  include: ['dependencies', 'devDependencies', 'unlisted', 'exports', 'types', 'duplicates'],
  workspaces: {
    '.': { entry },
    // Both depths, like `pnpm-workspace.yaml` — a package sits at the root of
    // `packages/` or inside its family. Naming each family was a second copy of
    // the tree, and it went stale the day a family was added.
    'packages/*': { entry },
    'packages/*/*': { entry },
    // Loaded by the Nuxt module at runtime, never imported by the package.
    'packages/app/nuxt': { entry: [...entry, 'src/runtime/**/*.ts'] },
    // A command is resolved by name from the CLI's own frond, not imported.
    'packages/cli': { entry: [...entry, 'src/bin.ts', 'app/commands/**/*.ts'] },
    /**
     * `require.resolve('graphql')` in a `try`/`catch` whose `catch` says *"No GraphQL in
     * this project — nothing to pin"*. A probe for what MAY be there is not a dependency,
     * and reporting it as `unlisted` costs the one finding class this step is kept for.
     */
    'packages/testing': { entry, ignoreDependencies: ['graphql'] },
  },
  // Copied, never imported: a scaffold template is source for an app knip is not
  // looking at. Test fixtures are fronds too, loaded by the scan under test.
  ignore: ['packages/cli/templates/**', '**/tests/fixtures*/**'],
};

export default config;
