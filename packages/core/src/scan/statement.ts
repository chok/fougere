/** The scan, written as the STATEMENT an author would have written. */
import { relative } from 'node:path';
import { nameOf } from '../descriptor/frond.js';
import type { FrondDescriptor } from '../descriptor/frond.js';
import type { ScanResult } from './result.js';
import { type Aliases, type Live, operationsOf } from './contract.js';

/**
 * A file becomes the specifier the PROJECT already uses for it: `@fronds/blog/…`, the import scope
 * a handler names its neighbour by, and which the Nuxt module registers as an alias for every
 * frond it found.
 */
function specifierOf(filePath: string, frond: FrondDescriptor): string {
  const inside = relative(frond.source.path, filePath).replace(/\.tsx?$/, '.js');

  return `${frond.source.package}/${inside}`;
}

/** One alias per file, so a class imported twice is one binding and one identity. */
class Imports implements Aliases {
  private readonly byPath = new Map<string, string>();
  private readonly byValue = new Map<Live, string>();
  private readonly byClassName = new Map<string, Live>();
  private readonly lines: string[] = [];
  /** The frond a file belongs to — a named import needs the specifier its default got. */
  private frondOfFile = new Map<string, FrondDescriptor>();

  default(filePath: string, frond: FrondDescriptor, value?: Live): string {
    this.frondOfFile.set(filePath, frond);
    const known = this.byPath.get(filePath);
    if (known) {
      if (value) this.remember(value, known);

      return known;
    }
    const alias = `_${this.byPath.size}`;
    this.lines.push(`import ${alias} from '${specifierOf(filePath, frond)}';`);
    this.byPath.set(filePath, alias);
    if (value) this.remember(value, alias);

    return alias;
  }

  /** A view a handler declares beside itself — `PostPublic` is exported by name. */
  named(value: Live, filePath: string, name: string): string {
    const known = this.byValue.get(value);
    if (known) return known;
    const frond = this.frondOfFile.get(filePath);
    if (!frond) {
      throw new Error(
        `A statement cannot be written: ${name} lives in ${filePath}, which no frond imported first.`,
      );
    }
    const alias = `_${this.byPath.size}_${name}`;
    this.lines.push(`import { ${name} as ${alias} } from '${specifierOf(filePath, frond)}';`);
    this.remember(value, alias);

    return alias;
  }

  aliasOf(value: Live): string | undefined { return this.byValue.get(value); }
  classNamed(name: string): Live | undefined { return this.byClassName.get(name); }

  private remember(value: Live, alias: string): void {
    this.byValue.set(value, alias);
    const name = (value as { name?: string }).name;
    if (name) this.byClassName.set(name, value);
  }

  render(): string {
    return this.lines.join('\n');
  }
}

/** `{ ctor: X, deps: [...] }` when there is something to say, the bare class otherwise. */
function subject(alias: string, deps: string[], ...extra: string[]): string {
  const parts = [
    ...(deps.length ? [`deps: ${JSON.stringify(deps)}`] : []),
    ...extra.filter(Boolean),
  ];

  return parts.length ? `{ ctor: ${alias}, ${parts.join(', ')} }` : alias;
}

function frondOf(frond: FrondDescriptor, imports: Imports): string {
  const list = (items: string[]): string => `[${items.join(', ')}]`;
  const members: string[] = [];

  // Entities first, and by VALUE: an operation names its input and output as schemas, and
  // the one a `Partial<X>` derives from is found here rather than imported a second time.
  if (frond.entities.length) {
    members.push(`entities: ${list(frond.entities.map((e) =>
      imports.default(e.filePath, frond, e.entityClass as Live)))}`);
  }
  if (frond.handlers.length) {
    members.push(`handlers: ${list(frond.handlers.map((h) => subject(
      imports.default(h.filePath, frond, h.ctor as Live),
      h.deps,
      h.surface ? `surface: ${JSON.stringify(h.surface)}` : '',
      // What the scan read from source, and what no class carries at runtime. Without it
      // a host that boots from this statement serves a prefab's five ops and nothing else.
      h.operations.size ? `operations: ${operationsOf(h.operations, h.filePath, imports, '      ')}` : '',
    )))}`);
  }
  if (frond.presenters.length) {
    members.push(`presenters: ${list(frond.presenters.map((p) => subject(imports.default(p.filePath, frond), p.deps)))}`);
  }
  if (frond.collectors.length) {
    members.push(`collectors: ${list(frond.collectors.map((c) => subject(imports.default(c.filePath, frond), c.deps)))}`);
  }
  if (frond.providers.length) {
    members.push(`providers: ${list(frond.providers.map((p) => subject(
      imports.default(p.filePath, frond, p.ctor as Live),
      p.deps,
      // The container key, and a bundler is free to rewrite the class's own name — it did,
      // and a handler asking for `Communes` met a provider registered as `_Communes`.
      `name: ${JSON.stringify(nameOf(p))}`,
    )))}`);
  }
  // A seed is DATA, not a class — the one member a statement cannot derive from an import.
  if (frond.seeds.length) {
    members.push(`seeds: ${JSON.stringify(frond.seeds.map((s) => ({ entityName: s.entityName, data: s.data })))}`);
  }
  if (frond.surfaces) members.push(`surfaces: ${JSON.stringify(frond.surfaces)}`);
  // What `frond.config.ts` states — read BY the scan, so a host that boots from a written
  // statement never sees the file. It is the only answer for the kind of an op whose name
  // leads with no known verb, and the only one for a method inherited from a base class
  // the workspace scan cannot see.
  if (frond.operationsOverrides && Object.keys(frond.operationsOverrides).length) {
    members.push(`operationsOverrides: ${JSON.stringify(frond.operationsOverrides)}`);
  }

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
