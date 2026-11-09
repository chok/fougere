import type ts from '@typescript/typescript6';
import { ErrorCode } from '@fougere/core';

interface Site {
  /** `ClassName.method`, or `<fn>.name` for a module function. */
  at: string;
  code: ErrorCode;
}

export interface Refusals {
  /** `Handler.method` → the codes any path from it can reach. */
  byMethod: Map<string, Set<ErrorCode>>;
  /** How many refusal sites the walk started from — zero is a claim, not a failure. */
  sites: number;
}

const MASKED = new Set(['INTERNAL_ERROR']);

function nameOf(typescript: typeof ts, node: ts.Node): string | undefined {
  const named = node as { name?: ts.Node };
  const own = named.name && 'getText' in named.name ? (named.name as ts.Identifier).getText() : undefined;
  if (!own) return undefined;

  const owner = typescript.isMethodDeclaration(node) || typescript.isMethodSignature(node)
    ? (node.parent as { name?: ts.Identifier })?.name?.getText()
    : undefined;

  return `${owner ?? '<fn>'}.${own}`;
}

function holderOf(typescript: typeof ts, node: ts.Node): string | undefined {
  let at: ts.Node | undefined = node;
  while (at && !typescript.isMethodDeclaration(at) && !typescript.isFunctionDeclaration(at)) at = at.parent;

  return at ? nameOf(typescript, at) : undefined;
}

function codeIn(typescript: typeof ts, node: ts.NewExpression): ErrorCode | undefined {
  if (node.expression.getText() !== 'FougereError') return undefined;
  const first = node.arguments?.[0];
  if (!first || !typescript.isObjectLiteralExpression(first)) return undefined;

  const written = first.properties.find((one) => one.name?.getText() === 'code');
  const value = written && typescript.isPropertyAssignment(written) ? written.initializer.getText() : undefined;
  if (!value?.startsWith('ErrorCode.')) return undefined;

  const member = value.slice('ErrorCode.'.length);

  return member in ErrorCode ? ErrorCode[member as keyof typeof ErrorCode] : undefined;
}

function into<T>(held: Map<string, Set<T>>, key: string): Set<T> {
  const already = held.get(key);
  if (already) return already;

  const made = new Set<T>();
  held.set(key, made);

  return made;
}

/** Every refusal a program holds, and every call that reaches one. */
export function refusalsIn(typescript: typeof ts, program: ts.Program, isOperation: (name: string) => boolean): Refusals {
  const checker = program.getTypeChecker();
  const sites: Site[] = [];
  const callers = new Map<string, Set<string>>();

  for (const file of program.getSourceFiles()) {
    if (file.isDeclarationFile || file.fileName.includes('node_modules')) continue;

    const visit = (node: ts.Node): void => {
      if (typescript.isNewExpression(node)) {
        const code = codeIn(typescript, node);
        const at = code ? holderOf(typescript, node) : undefined;
        if (code && at && !MASKED.has(code)) sites.push({ at, code });
      }

      if (typescript.isMethodDeclaration(node)) {
        const own = nameOf(typescript, node);
        for (const overridden of overriddenBy(typescript, checker, node)) {
          if (own) into(callers, own).add(overridden);
        }
      }

      if (typescript.isCallExpression(node)) {
        const callee = calleeOf(typescript, checker, node);
        const caller = callee ? holderOf(typescript, node) : undefined;
        if (callee && caller && callee !== caller) {
          into(callers, callee).add(caller);
        }
      }

      typescript.forEachChild(node, visit);
    };
    visit(file);
  }

  return { sites: sites.length, byMethod: reached(sites, callers, isOperation) };
}

function overriddenBy(typescript: typeof ts, checker: ts.TypeChecker, method: ts.MethodDeclaration): string[] {
  const owner = method.parent;
  const named = method.name.getText();
  if (!typescript.isClassDeclaration(owner) || !owner.name) return [];
  const declared = checker.getSymbolAtLocation(owner.name);
  if (!declared) return [];

  const own = checker.getDeclaredTypeOfSymbol(declared);

  return checker.getBaseTypes(own as ts.InterfaceType)
    .map((base) => base.getProperty(named)?.declarations?.[0])
    .map((found) => (found ? nameOf(typescript, found) : undefined))
    .filter((name): name is string => name !== undefined);
}

function calleeOf(typescript: typeof ts, checker: ts.TypeChecker, node: ts.CallExpression): string | undefined {
  const target = node.expression;
  const found = checker.getSymbolAtLocation(target)
    ?? (typescript.isPropertyAccessExpression(target) ? checker.getSymbolAtLocation(target.name) : undefined);

  const symbol = found && found.flags & typescript.SymbolFlags.Alias ? checker.getAliasedSymbol(found) : found;

  const declared = symbol?.declarations?.[0];
  if (!declared) return undefined;

  const callable = typescript.isMethodDeclaration(declared)
    || typescript.isMethodSignature(declared)
    || typescript.isFunctionDeclaration(declared);

  return callable ? nameOf(typescript, declared) : undefined;
}

function reached(
  sites: readonly Site[],
  callers: Map<string, Set<string>>,
  isOperation: (name: string) => boolean,
): Map<string, Set<ErrorCode>> {
  const found = new Map<string, Set<ErrorCode>>();

  for (const site of sites) {
    const walked = new Set([site.at]);
    const queue = [site.at];

    while (queue.length > 0) {
      const at = queue.shift()!;
      if (isOperation(at)) into(found, at).add(site.code);
      for (const caller of callers.get(at) ?? []) {
        if (walked.has(caller)) continue;
        walked.add(caller);
        queue.push(caller);
      }
    }
  }

  return found;
}
