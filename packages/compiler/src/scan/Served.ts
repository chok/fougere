import { dirname, relative } from 'node:path';
import { refusalsOf, type ScanResult } from '@fougere/core';
import { servedSurfaces } from '@fougere/core/descriptor';
import type { FacadeOptions } from './FacadeOptions.js';

/**
 * The specifier a handler is reached by, from where the generated file sits.
 *
 * The type is written WITHOUT `typeof`: that names the CONSTRUCTOR, whose `keyof` is
 * `'prototype'`, and every operation would fail to compile against it.
 */
function specifierOf(filePath: string, outFile: string): string {
  const path = relative(dirname(outFile), filePath).replace(/\.tsx?$/, '.js');

  return path.startsWith('.') ? path : `./${path}`;
}

/**
 * A union of enum MEMBERS — BOTH halves of what a call can come back refusing.
 *
 * `refusalsOf` is core's own table, read here rather than restated: what an op declares is
 * walked from its throw sites, and what the framework adds follows from `kind` and `input`.
 * Writing only the first half would tell a page that an op refuses nothing, when every op can
 * meet a draining facade.
 *
 * `ErrorCode` is a string enum, so `'CONFLICT'` is not assignable to it — a literal would read
 * as the right thing and refuse to narrow `FougereError<Code>`, which is the whole point.
 */
function codesOf(contract: { kind?: 'query' | 'command'; input?: unknown; errors?: readonly string[] }): string {
  const codes = refusalsOf(contract);
  if (codes.length === 0) return 'never';

  return codes.map((code) => `ErrorCode.${code}`).join(' | ');
}

/**
 * An augmentation of `FougereOperations`, keyed the way a facade is ADDRESSED — `post.publish`, and
 * `public:post.publish` for a named surface.
 *
 * It AUGMENTS rather than declares, so a page reaches the keys through the package it already
 * imports: `useQuery('checkout', 'pay')` narrows against them without naming this file. The
 * interface it fills is empty in `@fougere/core/contract` — the facade is addressed the same way
 * on both sides of the wire, and a backend project builds without a front-end package.
 *
 * The prefix is `facadeKeyOf`'s own spelling, because it is the same distinction: a surface is a
 * second facade in front of the same handler, serving a subset of its operations. What each op can
 * refuse does not change with the surface — the code that throws is the same — but WHICH ops
 * exist does, and a client pointed at `/_fougere/call/public` must not be offered the rest.
 *
 * A browser reaches the default surface unless it is handed another endpoint, which is why the
 * unprefixed keys are the ones a composable narrows against.
 */
export function emitFacade(scan: ScanResult, options: FacadeOptions): string {
  const served: Served[] = [];

  for (const frond of scan.fronds) {
    for (const handler of frond.handlers) {
      // NOT `handler.surface`: a surface is also declared in `frond.config.ts`, which names an
      // address without opening a directory for it. `servedSurfaces` is the one reader of both,
      // and it answers `undefined` for the default the way `facadeKeyOf` spells it.
      for (const surface of servedSurfaces(frond, handler)) {
        served.push({
          at: surface ? `${surface}:${handler.address}` : handler.address,
          handler: `import('${specifierOf(handler.filePath, options.outFile)}').default`,
          ops: [...(handler.operations ?? [])].map(([name, contract]) => ({ name, codes: codesOf(contract) })),
        });
      }
    }
  }

  return facadeModule(served, 'what the scan found');
}

/** One address, who answers there, and what each of its operations can refuse. */
export interface Served {
  at: string;
  /**
   * The TYPE EXPRESSION the handler is reached by, whole — `import('./x.js').default` for a
   * scanned class, `import('./x.js').PostHandler` for the synthetic interface `sync` writes.
   *
   * The expression and not a specifier: a scan's handler is a default export and a synced one
   * is named, and a producer that hands over only the path leaves the reader to guess which.
   */
  handler: string;
  ops: { name: string; codes: string }[];
}

/**
 * The module itself — written once, from a scan or from a card.
 *
 * `fougere sync` has the same three facts about a frond in ANOTHER repository: the card names
 * the addresses, the operations, and what each one refuses. What it does not have is the
 * handler's class, so it writes a synthetic interface and points here at that instead. Two
 * producers, one spelling — a second copy of this format would drift the day one gained a
 * member.
 */
export function facadeModule(served: readonly Served[], source: string): string {
  const rows = served.flatMap((one) => one.ops.map((op) => `  '${one.at}.${op.name}': { errors: ${op.codes} };`));
  const handlers = new Map(served.map((one) => [one.at, one.handler]));

  // A named surface shares its handler's class name, so two of them would declare one const.
  // A browser reaches the DEFAULT surface unless it was handed another endpoint, which is the
  // one a page names; the prefixed keys stay in `FougereOperations` for whoever reads them.
  const facades = [...handlers].filter(([at]) => !at.includes(':')).sort();

  return [
    `// Generated by Fougere from ${source} — do not edit, and do not commit.`,
    '// Rewritten whenever the app boots, so it cannot drift from the handlers it was read off.',
    '',
    "import type { ErrorCode, FacadeName } from '@fougere/core/contract';",
    '',
    "declare module '@fougere/core/contract' {",
    '  /** Every facade this app serves, and what each one refuses beyond what `kind` implies. */',
    '  interface FougereOperations {',
    ...(rows.length > 0 ? rows.sort().map((row) => `  ${row}`) : ['    // This app serves no facade.']),
    '  }',
    '',
    '  /** The class that answers at each address — its operations, and what each one answers. */',
    '  interface FougereHandlers {',
    ...[...handlers].sort().map(([at, type]) => `    '${at}': ${type};`),
    '  }',
    '}',
    '',
    '// One facade per address. A page IMPORTS it, so a project that never generated this file',
    "// fails to resolve rather than falling back to `string` in silence. The value is the",
    '// address and nothing else: the handler is reached as a TYPE, and no server code travels.',
    '//',
    '// Named after the ADDRESS, never after the class: what a page holds is a facade, and calling',
    "// it `PostHandler` would be a value claiming to be a class it is not. A page whose rows are",
    '// already called `post` aliases it on the import, the way any other collision is settled.',
    ...facades.map(([at, type]) =>
      `export const ${at}: FacadeName<${type}, '${at}'> = { address: '${at}' };`),
    '',
  ].join('\n');
}
