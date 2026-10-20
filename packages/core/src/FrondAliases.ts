import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import module from 'node:module';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createPathsMatcher, getTsconfig } from 'get-tsconfig';
import { DEFAULT_CONVENTIONS, frondPackage, type Conventions } from './Conventions.js';

/** Where `fougere sync` writes a frond another process serves — read by the same convention as `fronds/`. */
export const REMOTES = join('.fougere', 'remotes');

/** The table a built project keeps beside its JavaScript, alias → directory relative to it. */
export const ALIASES = 'aliases.json';

/** The module a built project keeps for the keys its config names by module — key → its import. */
export const MODULES = 'modules.js';

/**
 * The fronds whose directory does not give their name — `"@fronds/blog/*": ["./blog-v2/*"]` in
 * `fronds/tsconfig.json`, directory → name.
 *
 * The entry is read where TypeScript reads it, because TypeScript is the one reader that cannot be
 * told anything else: a rename stated anywhere besides would be a second statement of it.
 *
 * Documented: [fronds](https://fougere.dev/docs/infra/fronds).
 */
export function frondNamesOf(root: string, conventions: Conventions = DEFAULT_CONVENTIONS): Map<string, string> {
  const frondsDir = resolve(root, conventions.fronds);
  const path = join(frondsDir, 'tsconfig.json');
  const names = new Map<string, string>();
  if (!existsSync(path)) return names;

  const tsconfig = getTsconfig(frondsDir);
  const matches = tsconfig ? createPathsMatcher(tsconfig) : null;
  const prefix = `${conventions.scope}/`;
  for (const key of Object.keys(tsconfig?.config.compilerOptions?.paths ?? {})) {
    const name = key.startsWith(prefix) && key.endsWith('/*') ? key.slice(prefix.length, -'/*'.length) : '';
    if (!name || name.includes('*') || name.includes('/')) continue;

    const target = matches?.(`${prefix}${name}/x`)[0];
    const directory = target ? relative(frondsDir, dirname(target)).split(sep)[0] : undefined;
    if (directory && directory !== name && !directory.startsWith('..')) names.set(directory, name);
  }

  return names;
}

/** `@fronds/<name>` → the directory it names, for every frond of a project and every one `fougere sync` wrote. */
export async function frondAliases(root: string, conventions: Conventions = DEFAULT_CONVENTIONS): Promise<Record<string, string>> {
  const names = frondNamesOf(root, conventions);
  const aliases: Record<string, string> = {};
  for (const base of [conventions.fronds, REMOTES]) {
    const entries = await readdir(resolve(root, base), { withFileTypes: true }).catch(() => []);
    for (const directory of entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)) {
      const alias = frondPackage(names.get(directory) ?? directory, conventions);
      aliases[alias] ??= resolve(root, base, directory);
    }
  }

  return aliases;
}

/** The one resolve hook each runtime offers — Node's, and Bun's plugin, which Bun has in Node's place. */
interface BunRuntime {
  plugin(plugin: { name: string; setup(build: { onResolve(options: { filter: RegExp }, resolve: (args: { path: string }) => { path: string } | undefined): void }): void }): void;
}

/**
 * `@fronds/<name>` for the runtime itself, once a build turned the fronds into JavaScript — what a server
 * started by `fougere serve` resolves by, with no loader and no TypeScript. The longest alias wins, so
 * a renamed frond answers before the scope does.
 */
export function registerFrondAliases(aliases: Record<string, string>): void {
  const entries = Object.entries(aliases).sort(([left], [right]) => right.length - left.length);
  const fileOf = (specifier: string): string | undefined => {
    const hit = entries.find(([alias]) => specifier === alias || specifier.startsWith(`${alias}/`));

    return hit ? hit[1] + specifier.slice(hit[0].length) : undefined;
  };

  const bun = (globalThis as { Bun?: BunRuntime }).Bun;
  if (typeof module.registerHooks === 'function') {
    module.registerHooks({
      resolve(specifier, context, next) {
        const file = fileOf(specifier);

        return next(file ? pathToFileURL(file).href : specifier, context);
      },
    });
  } else if (bun) {
    const scopes = [...new Set(entries.map(([alias]) => alias.split('/')[0]!))];
    bun.plugin({
      name: 'fronds',
      setup(build) {
        build.onResolve({ filter: new RegExp(`^(${scopes.join('|')})/`) }, ({ path }) => {
          const file = fileOf(path);

          return file ? { path: file } : undefined;
        });
      },
    });
  } else {
    throw new Error('This runtime offers no resolve hook, so `@fronds/<name>` cannot be resolved in what `fougere build` wrote. Node 22.15 or Bun.');
  }
}
