/**
 * A file holds ONE concept, and a concept is what cannot be declared without its parts.
 *
 * The rule this checks is semantic, never statistical: the edges come from DECLARATIONS
 * — a field's type, a parameter, a return, a member of a union, a type predicate, a base
 * class, a type parameter's constraint — and never from a function body, an import, or a
 * count of callers. Counting callers answers how a name is USED today; two readers of one
 * type say nothing about whether it is one subject, and a name gains a second caller
 * without changing what it is.
 *
 * It reports the two ways a file can be wrong about its concept, and they are duals:
 *
 *   SPLIT   the names a file exports fall into several components — it holds several
 *           concepts under one sentence. `wire/call.ts` opened on "a frond call is a
 *           value" and held the identity card and the topology report.
 *   SCATTER a name that exactly ONE other declaration mentions, published by no door,
 *           living in another file — a concept spread over several. `TopologyReport`
 *           carries three imports for an interface of five fields; the three are its
 *           fields.
 *
 * The in-degree is on declarations, so it moves only when a second thing is DECLARED in
 * terms of the name — which is what a word joining the shared vocabulary means. That is
 * the whole difference with counting imports, and it is why the second clause is a rule
 * and not a heuristic.
 *
 * It reads through `@typescript/typescript6`: the native tsc at the root compiles, and does
 * not expose the compiler API this walks.
 *
 * A file under a CONVENTION directory — `entities/`, `handlers/`, the twelve of
 * `DEFAULT_CONVENTIONS.dirs` — is exempt from the second: the scan places it, so where it
 * sits is its declaration and no rule here may move it. The list is imported rather than
 * repeated, because a thirteenth directory would otherwise be a second copy going stale.
 *
 * A DOOR is exempt from the first clause: `index.ts` publishes what a package serves, and
 * naming several concepts is what it is for.
 *
 * A free FUNCTION is not a concept to place: `lowerFirst` and `upperFirst` share a file and
 * no type, and reading that as two concepts says nothing. So the components are over named
 * TYPES, while a function still counts as a declarer — a type mentioned only in one
 * function's signature belongs in that function's file, which is the same rule read
 * backwards.
 *
 * Its ceiling, and why the second clause REPORTS where the first REFUSES: the in-degree
 * says a name is mentioned once, not that it is subordinate. `AdminRuntimeOptions` in
 * `createAdminRuntime` is that function's options and belongs with it; `ArgumentResolver`
 * passed to `presenterArguments` is a class that function consumes. Telling the two apart
 * is a reading, so the list is a list.
 *
 * It reads names, not symbols. Two packages declaring one name are read as
 * one, and a name shadowed locally is read as the exported one. Both are reported as
 * ambiguous rather than guessed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from '@typescript/typescript6';
import { DEFAULT_CONVENTIONS } from '../packages/core/src/Conventions.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKIP = new Set(['node_modules', 'dist', 'tests', 'test', '__tests__', 'template', 'templates', '.fougere']);

/** A file in one of these is placed by the scan, so where it sits IS its declaration. */
const PLACED = new Set(Object.values(DEFAULT_CONVENTIONS.dirs));

function sources(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) sources(full, found);
    else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts') && !/\.(test|spec)\.ts$/.test(entry)) found.push(full);
  }

  return found;
}

type Named = ts.ClassDeclaration | ts.InterfaceDeclaration | ts.TypeAliasDeclaration | ts.EnumDeclaration | ts.FunctionDeclaration;

const NAMED = (node: ts.Node): node is Named =>
  ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) ||
  ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node) || ts.isFunctionDeclaration(node);

const isType = (node: ts.Node) => !ts.isFunctionDeclaration(node);

const exported = (node: ts.Node) =>
  ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);

function declaredNames(node: ts.Node): string[] {
  const names: string[] = [];
  const walk = (n: ts.Node) => {
    if (ts.isBlock(n)) return;
    if (ts.isPropertyDeclaration(n)) {
      if (n.type) walk(n.type);

      return;
    }
    if (ts.isTypeReferenceNode(n)) {
      names.push(ts.isIdentifier(n.typeName) ? n.typeName.text : n.typeName.right.text);
    }
    if (ts.isExpressionWithTypeArguments(n) && ts.isIdentifier(n.expression)) names.push(n.expression.text);
    ts.forEachChild(n, walk);
  };
  ts.forEachChild(node, walk);

  return names;
}

const owner = new Map<string, string>();
const ambiguous = new Set<string>();
const declares = new Map<string, string[]>();
const types = new Set<string>();
const published = new Set<string>();
const files = sources(path.join(ROOT, 'packages'));

for (const file of files) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ESNext, true);
  for (const node of src.statements) {
    if (NAMED(node) && node.name && exported(node)) {
      const name = node.name.text;
      if (owner.has(name)) ambiguous.add(name);
      else owner.set(name, file);
      if (isType(node)) types.add(name);
      declares.set(name, declaredNames(node));
    }
    if (path.basename(file) === 'index.ts' && ts.isExportDeclaration(node) && node.exportClause &&
        ts.isNamedExports(node.exportClause)) {
      for (const spec of node.exportClause.elements) published.add(spec.propertyName?.text ?? spec.name.text);
    }
  }
}

const parent = new Map<string, string>();
const find = (a: string): string => (parent.get(a) === a || !parent.has(a) ? a : find(parent.get(a)!));
const union = (a: string, b: string) => { const [x, y] = [find(a), find(b)]; if (x !== y) parent.set(x, y); };

for (const name of types) parent.set(name, name);
const inDegree = new Map<string, Set<string>>();
for (const [name, refs] of declares) {
  for (const ref of new Set(refs)) {
    if (!owner.has(ref) || ref === name) continue;
    if (types.has(name) && types.has(ref)) union(name, ref);
    (inDegree.get(ref) ?? inDegree.set(ref, new Set()).get(ref)!).add(name);
  }
}

const byFile = new Map<string, string[]>();
for (const [name, file] of owner) {
  if (types.has(name)) (byFile.get(file) ?? byFile.set(file, []).get(file)!).push(name);
}

const split: string[] = [];
for (const [file, names] of byFile) {
  if (path.basename(file) === 'index.ts') continue;
  const parts = new Set(names.map(find));
  if (parts.size > 1) split.push(`  ${path.relative(ROOT, file)} — ${parts.size} concepts : ${names.join(', ')}`);
}

const scatter: string[] = [];
for (const [name, from] of inDegree) {
  if (from.size !== 1 || published.has(name) || ambiguous.has(name)) continue;
  const holder = [...from][0]!;
  const file = owner.get(name)!;
  if (owner.get(holder) === file) continue;
  if (path.dirname(file).split(path.sep).some(part => PLACED.has(part))) continue;
  scatter.push(`  ${name} → ${holder}  [${path.relative(ROOT, file)}]`);
}

console.log(`concept-check: ${types.size} types among ${owner.size} exported names, ${files.length} files\n`);
console.log(`SPLIT — a file holding several concepts: ${split.length}`);
for (const line of split.sort()) console.log(line);
console.log(`\nSCATTER — a concept spread over several files: ${scatter.length}`);
for (const line of scatter.sort()) console.log(line);
if (ambiguous.size) console.log(`\nambiguous (one name, two packages): ${[...ambiguous].sort().join(', ')}`);

process.exit(split.length ? 1 : 0);
