/**
 * The scan, written as the STATEMENT an author would have written.
 *
 * A scan runs at build and the app runs elsewhere — two runtimes, no shared memory — so
 * something has to cross. What used to cross was the scan RESULT: every operation's
 * TypeScript signature re-serialized as JSON, beside the five CRUD ops `Crud.__ops`
 * declares at runtime anyway. A second writing of what the classes carry, and one that
 * drifts, since nothing compares the two.
 *
 * What crosses here is what `fronds.ts` holds: imports that bring the ORIGINAL classes
 * back, and `frond()` calls. Everything else `frond()` derives — `Post` is stored as
 * `post`, `PostHandler` answers at `post`, a computed field IS a method, and
 * `Presenter(Post)` keeps its subject. Only what TypeScript erases is named: a
 * constructor's parameter types (`deps`), and the surface a handler answers on, which the
 * scan read from its directory.
 *
 * Measured on demos/nuxt-blog: 102 lines of scan against 31 of statement, and the same app
 * — same rows, same computed fields, and no `typescript` loaded at boot.
 */
import { relative } from 'node:path';
import type { FrondDescriptor, ScanResult } from './frond.js';

type Live = { name?: string };

/**
 * A file becomes the specifier the PROJECT already uses for it: `@fronds/blog/…`, the
 * import scope a handler names its neighbour by, and which the Nuxt module registers as an
 * alias for every frond it found.
 *
 * A relative path would name the same file by a second route, and two routes to one module
 * are two modules — so `Post` would not equal `Post` and every identity check would fail
 * quietly. It also puts the file outside what the alias resolves, which is what made Node,
 * not the bundler, read the frond's `.ts` and answer 500 on `../entities/Post.js`.
 *
 * `.js`, because the source is `.ts` and the project spells a TypeScript source that way
 * everywhere else — the alias resolves through the same rule as a hand-written import.
 */
function specifierOf(filePath: string, frond: FrondDescriptor): string {
  const inside = relative(frond.source.path, filePath).replace(/\.tsx?$/, '.js');

  return `${frond.source.package}/${inside}`;
}

/** One alias per file, so a class imported twice is one binding and one identity. */
class Imports {
  private readonly byPath = new Map<string, string>();
  private readonly lines: string[] = [];

  default(filePath: string, frond: FrondDescriptor): string {
    const known = this.byPath.get(filePath);
    if (known) return known;
    const alias = `_${this.byPath.size}`;
    this.lines.push(`import ${alias} from '${specifierOf(filePath, frond)}';`);
    this.byPath.set(filePath, alias);

    return alias;
  }

  render(): string {
    return this.lines.join('\n');
  }
}

/** `{ ctor: X, deps: [...] }` when there is something to say, the bare class otherwise. */
function subject(alias: string, deps: string[], extra = ''): string {
  const parts = [
    ...(deps.length ? [`deps: ${JSON.stringify(deps)}`] : []),
    ...(extra ? [extra] : []),
  ];

  return parts.length ? `{ ctor: ${alias}, ${parts.join(', ')} }` : alias;
}

function frondOf(frond: FrondDescriptor, imports: Imports): string {
  const list = (items: string[]): string => `[${items.join(', ')}]`;
  const members: string[] = [];

  if (frond.entities.length) {
    members.push(`entities: ${list(frond.entities.map((e) => imports.default(e.filePath, frond)))}`);
  }
  if (frond.handlers.length) {
    members.push(`handlers: ${list(frond.handlers.map((h) =>
      subject(imports.default(h.filePath, frond), h.deps, h.surface ? `surface: ${JSON.stringify(h.surface)}` : '')))}`);
  }
  if (frond.presenters.length) {
    members.push(`presenters: ${list(frond.presenters.map((p) => subject(imports.default(p.filePath, frond), p.deps)))}`);
  }
  if (frond.collectors.length) {
    members.push(`collectors: ${list(frond.collectors.map((c) => subject(imports.default(c.filePath, frond), c.deps)))}`);
  }
  if (frond.providers.length) {
    members.push(`providers: ${list(frond.providers.map((p) => subject(imports.default(p.filePath, frond), p.deps)))}`);
  }
  // A seed is DATA, not a class — the one member a statement cannot derive from an import.
  if (frond.seeds.length) {
    members.push(`seeds: ${JSON.stringify(frond.seeds.map((s) => ({ entityName: s.entityName, data: s.data })))}`);
  }
  if (frond.surfaces) members.push(`surfaces: ${JSON.stringify(frond.surfaces)}`);

  const scope = (frond.source.package as string | undefined)?.split('/')[0];
  if (scope) members.push(`scope: ${JSON.stringify(scope)}`);

  return `  frond(${JSON.stringify(frond.name)}, {\n    ${members.join(',\n    ')},\n  })`;
}

/** The scan as a list of `frond()` calls — the file an author writes, written for them. */
// Nothing is written relative to the destination, so where the file SITS is not a
// parameter — the alias resolves the same from anywhere.
export function emitStatement(scan: ScanResult): string {
  const imports = new Imports();
  const fronds = scan.fronds.map((f) => frondOf(f as FrondDescriptor & { source: Live }, imports));

  return [
    '// Generated by @fougere/nuxt — what the scan found, as the statement you would write.',
    '//',
    '// Classes are IMPORTED, never restated: `frond()` derives every name from them. Write',
    '// your own `fronds.ts` beside `fougere.config.ts` to state this by hand instead.',
    "import { frond } from '@fougere/core';",
    imports.render(),
    '',
    'export default [',
    `${fronds.join(',\n')},`,
    '];',
    '',
  ].join('\n');
}
