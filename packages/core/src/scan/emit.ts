/**
 * The scan, written down as a module — what `createApp` is handed where there is no disk.
 *
 * It RE-RESOLVES NOTHING. By the time this runs the scan has already decided what every
 * slot holds, and `resolveSchema` put the entity's own class in `contract.output` — the
 * very object `EntityEntry.entityClass` holds. So the emitter keeps a table from object
 * to import alias and writes the alias. Identity is preserved because it is the same
 * object that becomes the same import, which is what three call sites depend on
 * (`adapter/graphql`'s `view === entity.entityClass` and its WeakMap, and `bootstrap`'s
 * `outputSchema !== entity.entityClass`). An emitter that re-resolved instead would build
 * a second class for `Post` and those three would silently take the other branch.
 *
 * Measured on three real projects: every live reference is either a class the descriptor
 * already names by `filePath`, a named export of the file that declared the signature, or
 * `Partial<X>` — the one derivation `resolveSchema` fabricates.
 */
import { dirname, relative } from 'node:path';
import { ANONYMOUS_SCHEMA_NAME, Card, type SchemaView } from '@fougere/schema';
import type { FrondDescriptor, EntityEntry, HandlerEntry, PresenterEntry, CollectorEntry, ProviderEntry, SeedEntry } from '../descriptor/frond.js';
import type { ScanResult } from './result.js';
import type { OperationContract } from '../wire/operation.js';

export interface EmitOptions {
  /** Where the generated module will sit. Imports are written relative to it. */
  outFile: string;
  /** How `@fougere/core` is reached from there. Default: the package name. */
  core?: string;
}

type Live = object;

/** Is a TypeScript compiler going to read this module? Its name is the only thing that says. */
const isTypeScript = (outFile: string): boolean => /\.tsx?$/.test(outFile);

/**
 * A source file becomes a specifier its reader can follow — and the two readers differ.
 *
 * A `.ts` destination is compiled by tsc under Node16 resolution, which spells a
 * TypeScript source with `.js`. A `.mjs` destination is read by a bundler, which resolves
 * the path AS IT IS ON DISK — measured, Nitro's rollup refused `Post.seed.js` because no
 * such file exists. One rule, read off the destination, exactly like the type annotation.
 */
function specifierOf(filePath: string, outFile: string): string {
  const path = relative(dirname(outFile), filePath);
  const rel = isTypeScript(outFile) ? path.replace(/\.tsx?$/, '.js') : path;
  return rel.startsWith('.') ? rel : `./${rel}`;
}

const lit = (v: unknown): string => JSON.stringify(v ?? null);

class Imports {
  private readonly byValue = new Map<Live, string>();
  private readonly lines: string[] = [];
  /** Entity classes by their class name — what a `Partial<X>` names as its source. */
  readonly byClassName = new Map<string, Live>();

  constructor(private readonly outFile: string) {}

  /** Register `value` as the default export of `filePath`, and answer its alias. */
  default(value: Live, filePath: string): string {
    const known = this.byValue.get(value);
    if (known) return known;
    const alias = `_${this.lines.length}`;
    this.lines.push(`import ${alias} from '${specifierOf(filePath, this.outFile)}';`);
    this.byValue.set(value, alias);
    return alias;
  }

  /** Register `value` as a NAMED export of `filePath` — its class name is the export. */
  named(value: Live, filePath: string, name: string): string {
    const known = this.byValue.get(value);
    if (known) return known;
    const alias = `_${this.lines.length}`;
    this.lines.push(`import { ${name} as ${alias} } from '${specifierOf(filePath, this.outFile)}';`);
    this.byValue.set(value, alias);
    return alias;
  }

  has(value: Live): boolean { return this.byValue.has(value); }
  aliasOf(value: Live): string | undefined { return this.byValue.get(value); }
  render(): string { return this.lines.join('\n'); }
}

/**
 * What a schema slot becomes in the generated module.
 *
 * Three answers, and the third is the only rule: a class already imported is its alias; a
 * named export of the file that declared the signature is imported by its own name — it
 * IS exported there, because that is where `resolveSchema` found it; and an anonymous
 * schema is `Partial<X>`, the one derivation `resolveSchema` builds, so it is written as
 * the derivation rather than as a value.
 */
function schemaRef(schema: SchemaView | undefined, declaredIn: string, imports: Imports): string | undefined {
  if (!schema) return undefined;
  const known = imports.aliasOf(schema as Live);
  if (known) return known;

  const name = (schema as { name?: string }).name;
  if (name && name !== ANONYMOUS_SCHEMA_NAME) return imports.named(schema as Live, declaredIn, name);

  const card = Card.fromSchema(schema);
  const source = card.origin?.from ?? card.descriptor.title;
  const from = source ? imports.byClassName.get(source) : undefined;
  if (from) return `${imports.aliasOf(from)}.partial()`;

  throw new Error(
    `A scan cannot be written down: an anonymous schema in ${declaredIn} names no source. `
    + 'Only `Partial<X>` is derivable here, and it says which X it came from.',
  );
}

function contractOf(op: string, c: OperationContract, declaredIn: string, imports: Imports): string {
  const parts: string[] = [];
  const input = schemaRef(c.input, declaredIn, imports);
  const output = schemaRef(c.output, declaredIn, imports);
  if (input) parts.push(`input: ${input}`);
  if (output) parts.push(`output: ${output}`);
  if (c.binding !== undefined) parts.push(`binding: ${lit(c.binding)}`);
  if (c.description !== undefined) parts.push(`description: ${lit(c.description)}`);
  if (c.cardinality !== undefined) parts.push(`cardinality: ${lit(c.cardinality)}`);
  if (c.signature !== undefined) parts.push(`signature: ${lit(c.signature)}`);
  return `[${lit(op)}, { ${parts.join(', ')} }]`;
}

function entityOf(e: EntityEntry, imports: Imports): string {
  return `{ name: ${lit(e.name)}, entityClass: ${imports.aliasOf(e.entityClass as Live)}, `
    + `filePath: ${lit(e.filePath)}, exposed: ${lit(e.exposed)} }`;
}

function handlerOf(h: HandlerEntry, imports: Imports): string {
  const ops = [...h.operations].map(([op, c]) => contractOf(op, c, h.filePath, imports));
  const override = schemaRef(h.outputOverride, h.filePath, imports);
  return `{ name: ${lit(h.name)}, address: ${lit(h.address)}, ctor: ${imports.aliasOf(h.ctor as Live)}, `
    + `deps: ${lit(h.deps)}, filePath: ${lit(h.filePath)}, exposed: ${lit(h.exposed)}, `
    + (h.surface ? `surface: ${lit(h.surface)}, ` : '')
    + (override ? `outputOverride: ${override}, ` : '')
    + `operations: new Map([\n      ${ops.join(',\n      ')}\n    ]) }`;
}

function presenterOf(p: PresenterEntry, imports: Imports): string {
  // `views` is not written: it is read back off the constructor (`__views`), so emitting
  // it would be a second copy of a statement the imported class already carries.
  return `{ entityName: ${lit(p.entityName)}, ctor: ${imports.aliasOf(p.ctor as Live)}, `
    + `fields: ${lit(p.fields)}, fieldMeta: ${lit(p.fieldMeta)}, deps: ${lit(p.deps)}, `
    + `filePath: ${lit(p.filePath)} }`;
}

function collectorOf(c: CollectorEntry, imports: Imports): string {
  return `{ typeName: ${lit(c.typeName)}, ctor: ${imports.aliasOf(c.ctor as Live)}, `
    + `deps: ${lit(c.deps)}, filePath: ${lit(c.filePath)} }`;
}

function providerOf(p: ProviderEntry, imports: Imports): string {
  return `{ ctor: ${imports.aliasOf(p.ctor as Live)}, deps: ${lit(p.deps)}, filePath: ${lit(p.filePath)} }`;
}

function seedOf(s: SeedEntry, imports: Imports): string {
  const data = typeof s.data === 'function' ? imports.aliasOf(s.data as Live) : lit(s.data);
  return `{ entityName: ${lit(s.entityName)}, data: ${data}, filePath: ${lit(s.filePath)} }`;
}

function frondOf(f: FrondDescriptor, imports: Imports): string {
  const list = (label: string, items: string[]) =>
    `    ${label}: [${items.length ? `\n      ${items.join(',\n      ')},\n    ` : ''}],`;
  return [
    '  {',
    `    name: ${lit(f.name)},`,
    `    source: ${lit(f.source)},`,
    list('providers', f.providers.map((p) => providerOf(p, imports))),
    list('entities', f.entities.map((e) => entityOf(e, imports))),
    list('handlers', f.handlers.map((h) => handlerOf(h, imports))),
    list('presenters', f.presenters.map((p) => presenterOf(p, imports))),
    list('collectors', f.collectors.map((c) => collectorOf(c, imports))),
    list('seeds', f.seeds.map((s) => seedOf(s, imports))),
    f.surfaces ? `    surfaces: ${lit(f.surfaces)},` : '',
    f.reads ? `    reads: ${lit(f.reads)},` : '',
    '  }',
  ].filter(Boolean).join('\n');
}

/**
 * Write a scan down. The result is a TypeScript module whose only imports are the classes
 * the scan found — static, so a bundler traces them — and whose only value is the
 * descriptor `createApp` asks for.
 */
export function emitScan(result: ScanResult, options: EmitOptions): string {
  const imports = new Imports(options.outFile);
  const core = options.core ?? '@fougere/core';

  // Every class the descriptor names by a file comes first: a schema slot holding one of
  // them then finds it in the table instead of being imported a second time.
  for (const f of result.fronds) {
    for (const e of f.entities) {
      imports.default(e.entityClass as Live, e.filePath);
      const name = (e.entityClass as { name?: string }).name;
      if (name) imports.byClassName.set(name, e.entityClass as Live);
    }
    for (const p of f.providers) imports.default(p.ctor as Live, p.filePath);
    for (const h of f.handlers) imports.default(h.ctor as Live, h.filePath);
    for (const p of f.presenters) imports.default(p.ctor as Live, p.filePath);
    for (const c of f.collectors) imports.default(c.ctor as Live, c.filePath);
    for (const s of f.seeds) if (typeof s.data === 'function') imports.default(s.data as Live, s.filePath);
  }

  const fronds = result.fronds.map((f) => frondOf(f, imports)).join(',\n');
  // `cause` is dropped: it is an Error, and the build that produced this already reported
  // it. What a boot logs is the message, and that travels.
  const diagnostics = result.diagnostics.map(({ cause: _cause, ...rest }) => lit(rest));

  // The annotation is a convenience for a file a human's tsc will read; it is never what
  // makes the value correct. A bundler parses a `.mjs` as JavaScript and `import type`
  // stops it dead — measured, Nitro's rollup refused the Nuxt template at that line.
  const typed = isTypeScript(options.outFile);

  return `// Generated by \`fougere build\` — the scan, written down. Do not edit.
//
// \`createApp\` reads this instead of a disk. Everything here was decided by the scan that
// produced it; nothing is resolved a second time.
import { Fronds } from '${core}';
${typed ? `import type { ScanResult } from '${core}';\n` : ''}${imports.render()}

export const scan${typed ? ': ScanResult' : ''} = {
  fronds: Fronds.hosting([
${fronds}
  ]),
  diagnostics: [${diagnostics.join(', ')}],
};
`;
}
