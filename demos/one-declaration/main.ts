/**
 * Six lines in. Everything else out.
 *
 * This demo writes ONE entity and then asks four different consumers what they
 * make of it — the SQL dialect, the wire, the io projection, the judge. Nobody
 * wrote any of the four. Run it and read the arrows.
 */
import { entity, primary, text, number, auto, describe, inputFields, outputFields } from '@fougere/schema';
import { toTable, createTableSQL } from '@fougere/schema-sql';

// ─────────────────────────────────────────────────────────────────────────────
// WHAT YOU WRITE
// ─────────────────────────────────────────────────────────────────────────────

class Reading extends entity({
  id: primary(),
  station: text({ min: 2, max: 40 }),
  celsius: number({ min: -90, max: 60 }),
  recordedAt: auto(),
}) {}

// ─────────────────────────────────────────────────────────────────────────────

const B = (s: string) => `\x1b[1m${s}\x1b[0m`;
const D = (s: string) => `\x1b[2m${s}\x1b[0m`;
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;

function section(arrow: string, title: string, who: string) {
  console.log(`\n${D('  ' + arrow)}  ${B(title)}\n     ${D(who)}\n`);
}

console.log(`
  ${G('🌿 fougere')}  one declaration

  ${B('class Reading extends entity({')}
  ${B('  id: primary(),')}
  ${B("  station: text({ min: 2, max: 40 }),")}
  ${B('  celsius: number({ min: -90, max: 60 }),')}
  ${B('  recordedAt: auto(),')}
  ${B('}) {}')}
`);

// ── 1. the database ──────────────────────────────────────────────────────────
section('→', 'The table', 'schema-sql, sqlite dialect — nobody wrote this DDL');
const ddl = createTableSQL(toTable('reading', Reading as never), 'sqlite');
console.log(ddl.replace(/, (constraint)/g, ',\n       $1').replace(/\((\"id\")/, '(\n       $1').replace(/, (\"station\"|\"celsius\"|\"recorded_at\")/g, ',\n       $1'));
console.log(D(`
     The bounds became CHECK constraints. So raw SQL, another process, or a
     human at a prompt meets "at least 2 characters" too — not just this app.`));

// ── 2. the wire ──────────────────────────────────────────────────────────────
section('→', 'The identity card', 'what crosses to another language — plain JSON Schema');
const card = describe(Reading as never, 'reading');
console.log(JSON.stringify(card, null, 2).split('\n').map((l) => '     ' + l).join('\n'));
console.log(D(`
     ${JSON.stringify(card).length} bytes, and any validator on earth reads it. This is the
     document demos/rust-frond publishes — a Frond written in Rust, consumed
     from TypeScript, with no shared code.`));

// ── 3. the io projection ─────────────────────────────────────────────────────
section('→', 'What a client may send, and what it gets back', 'the boundary axis — nobody listed these');
const may = Object.keys(inputFields(Reading.getFields() as never));
const gets = Object.keys(outputFields(Reading.getFields() as never));
console.log(`     ${D('a client may send   ')} ${may.join(', ')}`);
console.log(`     ${D('a client receives   ')} ${gets.join(', ')}`);
console.log(D(`
     Nobody wrote "a client cannot supply an id". primary() and auto() say it,
     and the door reads them.`));

// ── 4. the judge ─────────────────────────────────────────────────────────────
section('→', 'The judge', 'the same verdict in the browser, at the façade, and across a split');
for (const [label, input] of [
  ['{ station: "x", celsius: 200 }', { station: 'x', celsius: 200 }],
  ['{ station: "harbour", celsius: 12.1 }', { station: 'harbour', celsius: 12.1 }],
] as const) {
  const verdict = Reading.validate(input);
  console.log(`     ${D(label.padEnd(38))} ${verdict.success
    ? G('accepted')
    : R(verdict.errors.map((e) => `${e.path}: ${e.message}`).join(' · '))}`);
}

console.log(`
  ${B('Four consumers, one declaration.')} ${D('None of the four was written by hand, and')}
  ${D('none can drift from the others — there is nothing to keep in sync.')}
`);
