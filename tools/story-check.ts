/**
 * Can a long function be read as a story, without descending into it?
 *
 * A function whose body is a run of blank-line-separated paragraphs already lists its steps
 * — it just has not named them. Measured 2026-09-15 on `createApp` (`core/src/boot/bootstrap.ts`):
 * 651 lines, 60 paragraphs, and 36 of them opening with a comment. Those 36 names are
 * written, in prose, above the code they name.
 *
 * So this reports, and never refuses: where the steps are, and how many already carry their
 * name. Extracting one turns its comment into a method name, and the comment goes with it.
 * Which paragraphs belong together is a reading, not a count — see `concept-check.ts`, whose
 * SCATTER half reports for the same reason.
 *
 * `paragraphs` is what ranks: length alone puts a 200-line switch above a 40-line function
 * that hides four decisions, and only the second is a story waiting to be told.
 */
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import ts from '@typescript/typescript6';

const root = process.cwd();

/**
 * Calibrated against the style of this repo, 2026-09-15: a blank line before every `return`
 * and blocks kept apart, so a 17-line function has six paragraphs and reads perfectly. Under
 * 30 lines a break is aeration, not a step. At (15, 4) the tool answered 97 and half were airy
 * guards; at (30, 5) it answers 42 and `EntityAdapterSet.of` — a run of refusals — is out.
 */
const MIN_LINES = 30;
const MIN_PARAGRAPHS = 5;

interface Telling {
  at: string;
  name: string;
  lines: number;
  paragraphs: number;
  named: number;
}

const sources = execSync("git ls-files 'packages/*/src/**/*.ts' 'packages/*/*/src/**/*.ts'", {
  cwd: root, encoding: 'utf8', maxBuffer: 1 << 28,
}).trim().split('\n').filter(Boolean);

/** The paragraphs of a body, and how many open with a comment — their name, already written. */
function paragraphsOf(body: string): { paragraphs: number; named: number } {
  const groups = body.split(/\n\s*\n/).map((one) => one.trim()).filter(Boolean);

  return { paragraphs: groups.length, named: groups.filter((one) => one.startsWith('//') || one.startsWith('/*')).length };
}

function nameOf(node: ts.Node, source: ts.SourceFile): string {
  const named = node as { name?: ts.Node };

  return named.name ? named.name.getText(source) : '(anonymous)';
}

const told: Telling[] = [];

for (const file of sources) {
  const text = readFileSync(path.join(root, file), 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true);

  const visit = (node: ts.Node): void => {
    const body = (node as { body?: ts.Node }).body;
    const holdsOne = ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)
      || ts.isConstructorDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node);

    if (holdsOne && body && ts.isBlock(body)) {
      const from = source.getLineAndCharacterOfPosition(body.getStart(source)).line;
      const to = source.getLineAndCharacterOfPosition(body.getEnd()).line;
      const lines = to - from - 1;
      if (lines >= MIN_LINES) {
        const inner = text.slice(body.getStart(source) + 1, body.getEnd() - 1);
        const { paragraphs, named } = paragraphsOf(inner);
        if (paragraphs >= MIN_PARAGRAPHS) {
          told.push({ at: `${file}:${from + 1}`, name: nameOf(node, source), lines, paragraphs, named });
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

told.sort((a, b) => b.paragraphs - a.paragraphs || b.lines - a.lines);

for (const one of told) {
  console.log(
    `  ${String(one.paragraphs).padStart(3)} steps  ${String(one.lines).padStart(4)} lines  `
    + `${String(one.named).padStart(3)} named   ${one.at}  ${one.name}`,
  );
}

const byPackage = new Map<string, number>();
for (const one of told) {
  const owner = one.at.split('/src/')[0]!;
  byPackage.set(owner, (byPackage.get(owner) ?? 0) + 1);
}

console.log(`\n${told.length} function(s) list their steps without naming them, over ${sources.length} file(s)`);
for (const [owner, count] of [...byPackage].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(3)}  ${owner}`);
}
console.log('\n`named` is how many steps open with a comment — extracting one turns that comment into its name.');
