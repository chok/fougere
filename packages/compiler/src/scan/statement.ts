/** The scan, written as the STATEMENT an author would have written. */
import { type ScanResult } from '@fougere/core';
import { lowerFirst } from '@fougere/schema';
import { nameOf, refusalOf, type FrondDescriptor, type PresenterEntry } from '@fougere/core/descriptor';
import { frondConfigFileIn } from '@fougere/core/node';
import { dirname, relative } from 'node:path';

import { type Aliases } from './Aliases.js';
import { operationsOf, type Live } from './Live.js';

/**
 * A file becomes the specifier the PROJECT already uses for it: `@fronds/blog/…`, the import scope
 * a handler names its neighbour by, and which the Nuxt module registers as an alias for every
 * frond it found. Written where no bundler holds that alias — Node, esbuild for a Worker — it is
 * the path from the file the statement sits in.
 */
function specifierOf(filePath: string, frond: FrondDescriptor, outFile: string | undefined): string {
  if (outFile) {
    const path = relative(dirname(outFile), filePath).replace(/\.tsx?$/, '.js');

    return path.startsWith('.') ? path : `./${path}`;
  }
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

  /** Per frond, the file each imported value is declared in — what a refusal names. */
  private readonly declaredIn = new Map<string, Map<string, string>>();

  constructor(private readonly outFile?: string) {}

  /** `files: [[_0, '/app/fronds/blog/entities/Post.ts'], …]` for the values this frond imported. */
  filesOf(frond: FrondDescriptor): string {
    const declared = [...(this.declaredIn.get(frond.name) ?? [])];

    return declared.length ? `files: [${declared.map(([alias, path]) => `[${alias}, ${JSON.stringify(path)}]`).join(', ')}]` : '';
  }

  default(filePath: string, frond: FrondDescriptor, value?: Live): string {
    this.frondOfFile.set(filePath, frond);
    const declared = this.declaredIn.get(frond.name) ?? new Map<string, string>();
    this.declaredIn.set(frond.name, declared);
    const known = this.byPath.get(filePath);
    if (known) {
      declared.set(known, filePath);
      if (value) this.remember(value, known);

      return known;
    }
    const alias = `_${this.byPath.size}`;
    this.lines.push(`import ${alias} from '${specifierOf(filePath, frond, this.outFile)}';`);
    this.byPath.set(filePath, alias);
    declared.set(alias, filePath);
    if (value) this.remember(value, alias);

    return alias;
  }

  /** A term a `vocabulary/` file exports by name. */
  term(filePath: string, frond: FrondDescriptor, name: string): string {
    const alias = `_${this.byPath.size}_${name}`;
    this.lines.push(`import { ${name} as ${alias} } from '${specifierOf(filePath, frond, this.outFile)}';`);
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
        `fronds.ts cannot be written: ${name} in ${filePath} is not imported by any frond.`,
      );
    }
    const alias = `_${this.byPath.size}_${name}`;
    this.lines.push(`import { ${name} as ${alias} } from '${specifierOf(filePath, frond, this.outFile)}';`);
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
    members.push(`entities: ${list(frond.entities.map((e) => {
      const alias = imports.default(e.filePath, frond, e.entityClass as Live);

      // A derivation exported directly carries its factory's name; its own is its file's.
      return e.name === lowerFirst(e.entityClass.name) ? alias : `{ entity: ${alias}, name: ${JSON.stringify(e.name)} }`;
    }))}`);
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
  const files = imports.filesOf(frond);
  if (files) members.push(files);

  return `  frond(${JSON.stringify(frond.name)}, {\n    ${members.join(',\n    ')},\n  })`;
}

/** What the scan reports when it could not decide a contract — the statement cannot be written then. */
const UNDECIDED = new Set(['input-contract-ambiguous']);

/**
 * The scan as a list of `frond()` calls — the file an author writes, written for them. With no
 * `outFile` its imports go through the frond aliases, which resolve the same from anywhere.
 */
export function emitStatement(scan: ScanResult, options: { outFile?: string } = {}): string {
  // A contract the scan could not decide is not written as an incomplete one: the boot reading the
  // statement would serve an input nobody chose.
  const undecided = refusalOf(scan.diagnostics.filter((one) => UNDECIDED.has(one.code)), 'operation contract(s) the scan could not decide');
  if (undecided) throw undecided;
  const imports = new Imports(options.outFile);
  const terms = (scan.vocabulary ?? []).flatMap(({ filePath, name }) => {
    const frond = scan.fronds.find((one) => filePath.startsWith(`${one.source.path}/`));

    return frond ? [imports.term(filePath, frond, name)] : [];
  });
  const fronds = scan.fronds.map((f) => frondOf(f as FrondDescriptor & { source: Live }, imports));

  return [
    '// Generated by the scan — what it found, as the statement you would write.',
    '//',
    '// Classes are IMPORTED, never restated: `frond()` derives every name from them. Write',
    '// your own `fronds.ts` beside `fougere.config.ts` to state this by hand instead.',
    "import { ErrorCode, frond } from '@fougere/core';",
    imports.render(),
    '',
    // Always stated, empty or not, so a host reading `statement.vocabulary` compiles either way.
    `export const vocabulary = [${terms.join(', ')}];`,
    '',
    'export default [',
    ...fronds.map((one) => `${one},`),
    '];',
    '',
  ].join('\n');
}
