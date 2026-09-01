/**
 * No family of a package may depend on a family that depends back — unless this file
 * says so, and says why.
 *
 * `.dependency-cruiser.cjs` states in its header why it carries NO cycle rule: it runs
 * on TS <7 while the root is TS 7, so it cannot tell an `import type` from a runtime
 * import, and 30 of its MODULE-level cycles are pairs TypeScript erases. This asks a
 * different question — a cycle between two DIRECTORIES of one `src/` — and the erasure
 * does not settle it: a family cycle is about PLACEMENT, and a type it erases still says
 * a thing sits in the wrong family. Measured 2026-09-01, when core went from three such
 * cycles to none: all three were type-only, and each was one misplaced thing rather than
 * two tangled families — `RouteKind` reached through `DispatchEvent`, and three functions
 * taking an `App` sat on the wire. A guard blind to those would have watched it happen.
 *
 * So both are reported; `(type-only)` marks the ones the emitted JS does not contain.
 *
 * It reads PAIRS, and that is its ceiling: the same commit read as a graph is ONE
 * strongly connected component of eight directories out of ten, held by eight erased
 * edges — three of which sufficed. Three pairs and one eight-way tangle are the same
 * fact seen at two resolutions, and this file only reaches the first. It exists because
 * the tool that reads the second is not published; when it is, delete this.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/** A cycle this repo has WEIGHED and keeps. Anything else fails the check. */
const STATED = new Map([
  ['packages/schema judge↔schema',
    'Two owners addressing each other, symmetric (10 edges each way): the schema holds ' +
    'the facts, the judge holds the verdict, and neither owns the other. Nesting `judge/` ' +
    'under `schema/` would say the schema owns the decision, which `RowJudge.of(fields)` denies.'],
  ['packages/schema projection↔schema',
    'A projection and its inverse: the three axes reach `card/admission.ts` to ADMIT a ' +
    'wire value back into a schema. The return edge is the dual, not a leak.'],
  ['packages/schema entity↔schema',
    'Type-only and shallow: an entity states `unique`, `adapters` and `previousNames` ' +
    'about ITSELF and the schema reads them, while the two declarations name `Fields` ' +
    'because the field vocabulary is the schema\'s. Mutual by definition, two edges deep.'],
]);

const familyOf = (rel) => (rel.includes(path.sep) ? rel.split(path.sep)[0] : '(root)');

function tsFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) {
      if (entry !== 'node_modules' && entry !== 'dist') tsFiles(p, out);
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/** Erased by tsc: `import type {…}`, or every specifier prefixed with `type`. */
function typeOnly(line) {
  if (/^\s*(import|export)\s+type\b/.test(line)) return true;
  const braces = line.match(/\{([^}]*)\}/);
  const members = braces ? braces[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
  return members.length > 0 && members.every((m) => m.startsWith('type '));
}

function edgesOf(pkg) {
  const root = path.join(pkg, 'src');
  const edges = new Map();
  for (const file of tsFiles(root)) {
    const rel = path.relative(root, file);
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
    for (const m of text.matchAll(/from '(\.[^']*)'/g)) {
      const line = text.slice(text.lastIndexOf('\n', m.index) + 1, m.index);
      if (!/^\s*(import|export)\b/.test(line)) continue; // a string, not an import
      const target = path.relative(root, path.resolve(path.dirname(file), m[1].replace(/\.js$/, '.ts')));
      const [a, b] = [familyOf(rel), familyOf(target)];
      if (a === b) continue;
      const key = `${a} ${b}`;
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push({ from: rel, to: target, value: !typeOnly(line) });
    }
  }
  return edges;
}

const packages = readdirSync('packages', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .flatMap((d) => {
    const here = path.join('packages', d.name);
    if (statSync(path.join(here, 'src'), { throwIfNoEntry: false })?.isDirectory()) return [here];
    return readdirSync(here, { withFileTypes: true })
      .filter((c) => c.isDirectory()
        && statSync(path.join(here, c.name, 'src'), { throwIfNoEntry: false })?.isDirectory())
      .map((c) => path.join(here, c.name));
  });

let unstated = 0;
let stated = 0;

for (const pkg of packages) {
  const edges = edgesOf(pkg);
  const seen = new Set();

  for (const key of edges.keys()) {
    const [a, b] = key.split(' ');
    if (a === '(root)' || b === '(root)') continue; // the root is outside the layering

    const back = edges.get(`${b} ${a}`);
    if (!back) continue;

    const pair = [a, b].sort();
    const id = `${pkg} ${pair[0]}↔${pair[1]}`;
    if (seen.has(id)) continue;
    seen.add(id);

    if (STATED.has(id)) {
      stated++;
      continue;
    }

    unstated++;
    const erased = !edges.get(key).some((e) => e.value) || !back.some((e) => e.value);
    const thin = edges.get(key).length <= back.length ? edges.get(key) : back;
    console.error(`\n✗ ${id} — ${edges.get(key).length}/${back.length} edges${erased ? ' (type-only)' : ''}`);
    console.error('  the thin side is what moves:');
    for (const e of thin) console.error(`    ${e.from} → ${e.to}${e.value ? '' : '  (type-only)'}`);
  }
}

if (unstated > 0) {
  console.error(
    `\n${unstated} unstated cycle(s). Move the thin side — a function, a type — to where it belongs,\n`
    + 'or state the cycle in tools/cycle-check.mjs with the reason it is not a defect.',
  );
  process.exit(1);
}

console.log(`no unstated cycle between families — ${packages.length} packages, ${stated} stated and kept`);
