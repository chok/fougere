import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Which adapters a PROJECT could load, read off its dependencies.
 *
 * The process cannot answer this: an entity may state a Postgres column type in an app
 * that boots on `adapter/memory`, which never loads `sql`, and nothing at runtime tells
 * that from a typo. A project's dependencies name every adapter it could ever load, so
 * this is the one place a name can be judged — and it is a report, never a refusal.
 *
 * By CONVENTION, not by asking: an adapter registers under the suffix of its package
 * name (`@fougere/adapter-sql` → `sql`), the same way `Adapters.register('sql', …)`
 * spells it. An adapter that registers under some other name is invisible here, which
 * costs a false report and never a false silence.
 */
const ADAPTER_PACKAGE = /^@fougere\/adapter-(.+)$/;

/**
 * The adapter names this project depends on — empty when it has no package.json to read.
 * FR : les noms d'adaptateurs dont ce projet dépend — vide s'il n'a pas de package.json.
 * a project depending on `@fougere/adapter-sql` and `@fougere/adapter-rest`
 * → `['sql', 'rest']`
 */
export async function adaptersOf(root: string): Promise<string[]> {
  const manifest = await read(join(root, 'package.json'));
  if (!manifest) return [];

  const declared = { ...manifest.dependencies, ...manifest.devDependencies };

  return Object.keys(declared)
    .map((name) => ADAPTER_PACKAGE.exec(name)?.[1])
    .filter((name): name is string => name !== undefined);
}

async function read(path: string): Promise<Manifest | undefined> {
  try {
    return JSON.parse(await readFile(path, 'utf8')) as Manifest;
  } catch {
    // No manifest, or one that is not JSON. Either way this cannot judge a name, and
    // reporting every `adapters:` key as unknown would be worse than saying nothing.
    return undefined;
  }
}

interface Manifest {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
