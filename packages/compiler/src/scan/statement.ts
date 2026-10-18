/** The scan, written as the STATEMENT an author would have written. */
import { type ScanResult } from '@fougere/core';
import { nameOf, type FrondDescriptor, type PresenterEntry } from '@fougere/core/descriptor';
import { frondConfigFileIn } from '@fougere/core/node';
import { relative } from 'node:path';

import { type Aliases } from './Aliases.js';
import { operationsOf, type Live } from './Live.js';

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

  /** A term a `vocabulary/` file exports by name. */
  term(filePath: string, frond: FrondDescriptor, name: string): string {
    const alias = `_${this.byPath.size}_${name}`;
    this.lines.push(`import { ${name} as ${alias} } from '${specifierOf(filePath, frond)}';`);
    this.byPath.set(`${filePath}#${name}`, alias);

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

/** What TypeScript erases of a computed field — its type and parameters — and only where it said any. */
function fieldMetaOf(presenter: PresenterEntry): string {
  const typed = presenter.fieldMeta.filter((meta) => Object.keys(meta).length > 1);

  return typed.length ? `fieldMeta: ${JSON.stringify(typed)}` : '';
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
    members.push(`presenters: ${list(frond.presenters.map((p) => subject(imports.default(p.filePath, frond), p.deps, fieldMetaOf(p))))}`);
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
      p.abstract ? 'abstract: true' : '',
    )))}`);
  }
  if (frond.middlewares.length) {
    members.push(`middlewares: ${list(frond.middlewares.map((m) => subject(imports.default(m.filePath, frond), m.deps)))}`);
  }
  if (frond.extensions?.length) {
    members.push(`extensions: ${list(frond.extensions.map((e) => {
      const alias = imports.default(e.filePath, frond);

      return typeof e.extension.name === 'string' ? alias : `{ ...${alias}, name: ${JSON.stringify(e.name)} }`;
    }))}`);
  }
  if (frond.seeds.length) {
    members.push(`seeds: ${list(frond.seeds.map((s) =>
      `{ entityName: ${JSON.stringify(s.entityName)}, data: ${imports.default(s.filePath, frond)} }`))}`);
  }
  // The file itself, which `frond()` reads the way the scan does: the order of the middlewares,
  // what is exposed, the overrides of an op.
  const config = frondConfigFileIn(frond.source.path);
  if (config) members.push(`config: ${imports.default(config, frond)}`);

  const scope = (frond.source.package as string | undefined)?.split('/')[0];
  if (scope) members.push(`scope: ${JSON.stringify(scope)}`);

  return `  frond(${JSON.stringify(frond.name)}, {\n    ${members.join(',\n    ')},\n  })`;
}

/** The scan as a list of `frond()` calls — the file an author writes, written for them. */
// Nothing is written relative to the destination, so where the file SITS is not a
// parameter — the alias resolves the same from anywhere.
export function emitStatement(scan: ScanResult): string {
  const imports = new Imports();
  const terms = (scan.vocabulary ?? []).flatMap(({ filePath, name }) => {
    const frond = scan.fronds.find((one) => filePath.startsWith(`${one.source.path}/`));

    return frond ? [imports.term(filePath, frond, name)] : [];
  });
  const fronds = scan.fronds.map((f) => frondOf(f as FrondDescriptor & { source: Live }, imports));

  return [
    '// Generated by @fougere/nuxt — what the scan found, as the statement you would write.',
    '//',
    '// Classes are IMPORTED, never restated: `frond()` derives every name from them. Write',
    '// your own `fronds.ts` beside `fougere.config.ts` to state this by hand instead.',
    "import { frond } from '@fougere/core';",
    imports.render(),
    '',
    ...(terms.length ? [`export const vocabulary = [${terms.join(', ')}];`, ''] : []),
    'export default [',
    `${fronds.join(',\n')},`,
    '];',
    '',
  ].join('\n');
}
