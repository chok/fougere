/**
 * What an operation can refuse, read by walking UP from every refusal to whoever reaches it.
 *
 * Reading a handler's own body answers "at least these", which is not a contract: a guard moved
 * into a helper — a refactor with no change of behaviour — would silently shrink what an app
 * promises. Measured on `site/fronds/blog`, the body of `publish` holds ONE throw and the walk
 * finds four, because the three that matter live in module functions beside it.
 *
 * Walking up rather than down, for the same reason a router indexes forward: there are a handful
 * of refusal sites and many operations, so the search starts from the few. An address resolved
 * through a port lands on the base's method and the union of what its realizations refuse, which
 * OVER-approximates — the honest direction for a contract, where a code that cannot happen costs
 * a dead branch and a code that can costs a surprise in production.
 *
 * It stops at the frond. What another frond refuses is published by ITS card.
 */
import type ts from '@typescript/typescript6';
import { ErrorCode } from '@fougere/core';

/** Where a refusal was written, and which one. */
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

/** A refusal this package raises about itself never reaches a caller, so it is not a contract. */
const MASKED = new Set(['INTERNAL_ERROR']);

/**
 * The name a call and a declaration agree on. A method carries its class so two `list` methods
 * are two subjects; a module function has no owner and says so rather than borrowing one.
 */
function nameOf(typescript: typeof ts, node: ts.Node): string | undefined {
  const named = node as { name?: ts.Node };
  const own = named.name && 'getText' in named.name ? (named.name as ts.Identifier).getText() : undefined;
  if (!own) return undefined;

  const owner = typescript.isMethodDeclaration(node) || typescript.isMethodSignature(node)
    ? (node.parent as { name?: ts.Identifier })?.name?.getText()
    : undefined;

  return `${owner ?? '<fn>'}.${own}`;
}

/** The method or function a node sits inside — where a refusal is charged. */
function holderOf(typescript: typeof ts, node: ts.Node): string | undefined {
  let at: ts.Node | undefined = node;
  while (at && !typescript.isMethodDeclaration(at) && !typescript.isFunctionDeclaration(at)) at = at.parent;

  return at ? nameOf(typescript, at) : undefined;
}

/**
 * `new FougereError({ code: ErrorCode.CONFLICT })` → `CONFLICT`, and nothing for a computed one.
 *
 * The member is read as TEXT, so it is judged against the enum before it travels: a walk reaches
 * files the project never compiles, and a name that is not a code would otherwise be published on
 * a card as one.
 */
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

/**
 * Read one program: every refusal, and every edge from a caller to what it calls.
 *
 * The checker is what makes an edge exact — `this.posts.findById()` resolves to the declaration
 * on `PostRepository`, which is the same node a refusal inside it was charged to. No name
 * matching, and no guess about what a dependency holds.
 */
export function refusalsIn(typescript: typeof ts, program: ts.Program, isOperation: (name: string) => boolean): Refusals {
  const checker = program.getTypeChecker();
  const sites: Site[] = [];
  /** callee → the callers that reach it. */
  const callers = new Map<string, Set<string>>();

  for (const file of program.getSourceFiles()) {
    if (file.isDeclarationFile || file.fileName.includes('node_modules')) continue;

    const visit = (node: ts.Node): void => {
      if (typescript.isNewExpression(node)) {
        const code = codeIn(typescript, node);
        const at = code ? holderOf(typescript, node) : undefined;
        if (code && at && !MASKED.has(code)) sites.push({ at, code });
      }

      if (typescript.isCallExpression(node)) {
        const callee = calleeOf(typescript, checker, node);
        const caller = callee ? holderOf(typescript, node) : undefined;
        if (callee && caller && callee !== caller) {
          (callers.get(callee) ?? callers.set(callee, new Set()).get(callee)!).add(caller);
        }
      }

      typescript.forEachChild(node, visit);
    };
    visit(file);
  }

  return { sites: sites.length, byMethod: reached(sites, callers, isOperation) };
}

/** The declaration a call resolves to, named the way a refusal site is. */
function calleeOf(typescript: typeof ts, checker: ts.TypeChecker, node: ts.CallExpression): string | undefined {
  const target = node.expression;
  const found = checker.getSymbolAtLocation(target)
    ?? (typescript.isPropertyAccessExpression(target) ? checker.getSymbolAtLocation(target.name) : undefined);

  // An IMPORTED function resolves to its import specifier, which is callable in no sense the
  // test below admits — so the edge was dropped and the refusal never climbed out of its file.
  // Measured on `site/fronds/blog`: moving three guards into a neighbouring module, which
  // `fougere check` asks for, cut what `publish` promises from five codes to two.
  const symbol = found && found.flags & typescript.SymbolFlags.Alias ? checker.getAliasedSymbol(found) : found;

  const declared = symbol?.declarations?.[0];
  if (!declared) return undefined;

  const callable = typescript.isMethodDeclaration(declared)
    || typescript.isMethodSignature(declared)
    || typescript.isFunctionDeclaration(declared);

  return callable ? nameOf(typescript, declared) : undefined;
}

/** From each refusal, climb its callers until an operation holds it. */
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
      if (isOperation(at)) (found.get(at) ?? found.set(at, new Set()).get(at)!).add(site.code);
      for (const caller of callers.get(at) ?? []) {
        if (walked.has(caller)) continue;
        walked.add(caller);
        queue.push(caller);
      }
    }
  }

  return found;
}
