/** The scan, written down as a module — what `createApp` is handed where there is no disk. */
import { dirname, relative } from 'node:path';
import { nameOf } from '../descriptor/frond.js';
import type { FrondDescriptor, EntityEntry, HandlerEntry, PresenterEntry, CollectorEntry, ProviderEntry, SeedEntry } from '../descriptor/frond.js';
import type { ScanResult } from './result.js';
import { type Aliases, type Live, lit, operationsOf, schemaRef } from './contract.js';

export interface EmitOptions {
  /** Where the generated module will sit. Imports are written relative to it. */
  outFile: string;
  /** How `@fougere/core` is reached from there. Default: the package name. */
  core?: string;
}

/** Is a TypeScript compiler going to read this module? Its name is the only thing that says. */
const isTypeScript = (outFile: string): boolean => /\.tsx?$/.test(outFile);

/** A source file becomes a specifier its reader can follow — and the two readers differ. */
function specifierOf(filePath: string, outFile: string): string {
  const path = relative(dirname(outFile), filePath);
  const rel = isTypeScript(outFile) ? path.replace(/\.tsx?$/, '.js') : path;
  return rel.startsWith('.') ? rel : `./${rel}`;
}

class Imports implements Aliases {
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
  classNamed(name: string): Live | undefined { return this.byClassName.get(name); }
  render(): string { return this.lines.join('\n'); }
}

function entityOf(e: EntityEntry, imports: Imports): string {
  return `{ name: ${lit(e.name)}, entityClass: ${imports.aliasOf(e.entityClass as Live)}, `
    + `filePath: ${lit(e.filePath)}, exposed: ${lit(e.exposed)} }`;
}

function handlerOf(h: HandlerEntry, imports: Imports): string {
  const ops = operationsOf(h.operations, h.filePath, imports, '    ');
  const override = schemaRef(h.outputOverride, h.filePath, imports);
  return `{ name: ${lit(h.name)}, address: ${lit(h.address)}, ctor: ${imports.aliasOf(h.ctor as Live)}, `
    + `deps: ${lit(h.deps)}, filePath: ${lit(h.filePath)}, exposed: ${lit(h.exposed)}, `
    + (h.surface ? `surface: ${lit(h.surface)}, ` : '')
    + (override ? `outputOverride: ${override}, ` : '')
    + `operations: ${ops} }`;
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
  return `{ name: ${lit(nameOf(p))}, ctor: ${imports.aliasOf(p.ctor as Live)}, `
    + `deps: ${lit(p.deps)}, filePath: ${lit(p.filePath)} }`;
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

/** Write a scan down. */
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
