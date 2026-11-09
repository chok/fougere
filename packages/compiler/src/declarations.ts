/** What a handler file declares besides its handler. */
import { type Conventions } from '@fougere/core';
import { type HandlerEntry } from '@fougere/core/descriptor';
import type ts from '@typescript/typescript6';
import { loadTS } from './scan/TypeProgram.js';
import { readFile } from 'node:fs/promises';

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

/** What a handler file declares besides its handler: a rule belongs in `rules/`, a service in `services/`. */
export async function handlerDeclarations(
  fronds: readonly {
    name: string;
    handlers: readonly Pick<HandlerEntry, 'name' | 'filePath'>[];
  }[],
  conventions: Conventions,
): Promise<HandlerDeclaration[]> {
  const typescript = await loadTS();
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
              ? `'${subject}' is declared in ${handler.name}, so nothing else can use it. Move it to `
                + `\`${conventions.dirs.rules}/\` if it only needs its arguments, or to \`${conventions.dirs.services}/\` if it has dependencies.`
              : `'${subject}' is declared in ${handler.name}, so nothing else can name this shape. Move it to `
                + `\`${conventions.dirs.entities}/\` beside the entity it describes, or to \`${conventions.dirs.rules}/\`.`,
        });
      }
    }
  }

  return found;
}
