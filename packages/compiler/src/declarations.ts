/** What a handler file declares besides its handler. */
import type ts from '@typescript/typescript6';
import { readFile } from 'node:fs/promises';
import type { Conventions } from './scan/conventions.js';
import type { HandlerEntry } from './descriptor/frond.js';

let _ts: typeof ts | undefined;
async function loadTs(): Promise<typeof ts> {
  if (!_ts) _ts = (await import('@typescript/typescript6')).default;
  return _ts;
}

export interface HandlerDeclaration {
  /** Stable rule name — the same vocabulary `verify()` uses. */
  rule: 'handler-declaration';
  frond: string;
  filePath: string;
  /** The handler that hosts it. */
  handler: string;
  /** What is declared — `AGREED_WITHIN`, `says`, `Assessment`. */
  subject: string;
  /** What it is in the source: a value, or a shape. */
  kind: 'value' | 'shape';
  message: string;
}

function subjectsOf(typescript: typeof ts, source: ts.SourceFile): [string, 'value' | 'shape'][] {
  const found: [string, 'value' | 'shape'][] = [];

  for (const statement of source.statements) {
    if (typescript.isVariableStatement(statement)) {
      for (const declared of statement.declarationList.declarations)
        if (typescript.isIdentifier(declared.name)) found.push([declared.name.text, 'value']);
    } else if (typescript.isFunctionDeclaration(statement) && statement.name) {
      found.push([statement.name.text, 'value']);
    } else if (
      typescript.isInterfaceDeclaration(statement) ||
      typescript.isTypeAliasDeclaration(statement) ||
      typescript.isEnumDeclaration(statement)
    ) {
      found.push([statement.name.text, 'shape']);
    }
  }

  return found;
}

/**
 * Everything a handler file declares that is not the handler itself.
 *
 * A handler names gestures; what a gesture uses is declared where its nature says, and one
 * question settles which: does it arrive INJECTED or IMPORTED? A threshold, a formula, a word
 * list arrive imported and belong under `rules/`. Anything holding a client, a connection or
 * a cursor arrives injected and belongs under `services/`. Neither ever belongs in the file
 * that calls it — nothing there can be reached by a second caller, and the handler grows into
 * the domain it was supposed to address.
 *
 * It names the two addresses, which `outsideConventions` does on the same question one file
 * higher. Saying "a module beside its entities" instead left the reader to invent a place,
 * and inventing one is the drift both rules report.
 */
export async function handlerDeclarations(
  fronds: readonly {
    name: string;
    handlers: readonly Pick<HandlerEntry, 'name' | 'filePath'>[];
  }[],
  conventions: Conventions,
): Promise<HandlerDeclaration[]> {
  const typescript = await loadTs();
  const found: HandlerDeclaration[] = [];

  for (const frond of fronds) {
    for (const handler of frond.handlers) {
      const text = await readFile(handler.filePath, 'utf8').catch(() => undefined);
      if (text === undefined) continue;

      const source = typescript.createSourceFile(
        handler.filePath,
        text,
        typescript.ScriptTarget.Latest,
        false,
      );

      for (const [subject, kind] of subjectsOf(typescript, source)) {
        found.push({
          rule: 'handler-declaration',
          frond: frond.name,
          filePath: handler.filePath,
          handler: handler.name,
          subject,
          kind,
          message:
            kind === 'value'
              ? `'${subject}' is declared in ${handler.name}, so only ${handler.name} can reach it. `
                + `If it needs nothing but its arguments, it is a word of '${frond.name}' and belongs `
                + `in \`${conventions.dirs.rules}/\`; if it holds a dependency, it belongs in `
                + `\`${conventions.dirs.services}/\`. Either way it is stated once and imported, and `
                + `the handler keeps only the gesture.`
              : `'${subject}' is declared in ${handler.name}, which makes the shape of what an `
                + `operation answers readable only from the file that answers it. A shape belongs `
                + `with the entity it describes in \`${conventions.dirs.entities}/\`, or in `
                + `\`${conventions.dirs.rules}/\` beside the words that compute it — where the caller, `
                + `the test and the other operations can all name it.`,
        });
      }
    }
  }

  return found;
}
