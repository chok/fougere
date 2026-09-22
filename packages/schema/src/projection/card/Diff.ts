import { dequal } from 'dequal';
import { Axes } from '../../axis/Axes.js';
import { Shapes } from '../../axis/shape/Shape.js';
import type { FieldDescriptor } from './FieldDescriptor.js';
import type { FieldExtension } from './FieldExtension.js';

import type { SchemaDescriptor } from './SchemaDescriptor.js';
import type { Change } from './Change.js';
import type { TypeSet } from './TypeSet.js';
import type { RenameCandidate } from './RenameCandidate.js';
import type { DiffOptions } from './DiffOptions.js';

export interface Diff {
  changes: Change[];
  /** Questions the comparison refuses to decide without an explicit rename declaration. */
  ambiguous: RenameCandidate[];
}

/**
 * What changed between two descriptions of the same entity, read from the wire form alone.
 * FR : ce qui a changé entre deux descriptions d'une même entité, lu du seul format du fil.
 * `compare(v1, v2, { renamed: { body: 'content' } })` → one `renamed`, no `ambiguous`
 *
 * Documented: [how a schema moves](https://fougere.dev/docs/schema/evolution).
 */
export function compare(
  was: SchemaDescriptor,
  is: SchemaDescriptor,
  options: DiffOptions = {},
): Diff {
  const renamed = options.renamed ?? {};
  const before = was.properties ?? {};
  const after = is.properties ?? {};
  const wasRequired = new Set(was.required ?? []);
  const isRequired = new Set(is.required ?? []);

  const kept: Change[] = [];
  const removed: string[] = [];
  // A declared rename first, so every difference below is read under the new name.
  for (const [field, descriptor] of Object.entries(before)) {
    const now = renamed[field] ?? field;
    const target = after[now];
    if (target === undefined) {
      removed.push(field);
      continue;
    }
    kept.push(...movedIn(field, now, descriptor, target, wasRequired.has(field), isRequired.has(now)));
  }

  const claimed = new Set(Object.values(renamed));
  const added = Object.keys(after).filter((field) => !(field in before) && !claimed.has(field));

  return {
    changes: [
      ...kept,
      ...removed.map((field): Change => ({
        kind: 'removed', field, from: before[field]!, required: wasRequired.has(field),
      })),
      ...added.map((field): Change => ({
        kind: 'added', field, to: after[field]!, required: isRequired.has(field),
      })),
    ],
    ambiguous: candidates(removed, added, before, after),
  };
}

/** What one field that survived the two descriptions says about itself now. */
function movedIn(
  field: string,
  now: string,
  before: FieldDescriptor,
  after: FieldDescriptor,
  was: boolean,
  is: boolean,
): Change[] {
  const changes: Change[] = [];
  if (now !== field) changes.push({ kind: 'renamed', from: field, to: now, field: after });

  const wasType = typesOf(before);
  const isType = typesOf(after);
  if (!dequal(wasType, isType)) changes.push({ kind: 'retyped', field: now, from: wasType, to: isType });
  else if (!dequal(boundsOf(before), boundsOf(after))) {
    changes.push({ kind: 'reshaped', field: now, from: before, to: after });
  }

  if (was !== is) changes.push({ kind: 'required', field: now, from: was, to: is });
  changes.push(...restated(now, before['x-fougere'], after['x-fougere']));

  return changes;
}

function restated(
  field: string,
  before: FieldExtension | undefined,
  after: FieldExtension | undefined,
): Change[] {
  return Axes.names.filter((axis) => !dequal(before?.[axis], after?.[axis])).map(
    (axis) =>
      ({
        kind: 'restated',
        field,
        axis,
        from: before?.[axis],
        to: after?.[axis],
      }) as Change,
  );
}

function shapeOf(descriptor: FieldDescriptor): Record<string, unknown> {
  const { 'x-fougere': _extension, description: _description, ...shape } = descriptor;

  return shape as Record<string, unknown>;
}

/**
 * Sorted, so `['string','null']` and `['null','string']` compare equal, not as a change.
 * FR : trié, pour que `['string','null']` et `['null','string']` soient égaux.
 * `typesOf({ type: ['null', 'string'] })` → `['null', 'string']`
 */
function typesOf(descriptor: FieldDescriptor): TypeSet {
  return [...Shapes.typesOf(descriptor)].sort();
}

/**
 * The shape without its type, which is what tells a `reshaped` from a `retyped`.
 * FR : la forme sans son type, ce qui distingue un `reshaped` d'un `retyped`.
 * `maxLength: 200` → `maxLength: 100` → one `reshaped`, never a `retyped`
 */
function boundsOf(descriptor: FieldDescriptor): Record<string, unknown> {
  const { type: _type, ...rest } = shapeOf(descriptor);

  return rest;
}

/**
 * A removal plus an addition of one shape is REPORTED, never resolved — only `renamed` decides.
 * FR : une suppression plus un ajout de même forme est RAPPORTÉE, jamais résolue.
 * `body` gone, `content` appeared → `ambiguous: [{ removed: 'body', added: 'content' }]`
 */
function candidates(
  removed: string[],
  added: string[],
  before: Record<string, FieldDescriptor>,
  after: Record<string, FieldDescriptor>,
): RenameCandidate[] {
  const found: RenameCandidate[] = [];
  for (const gone of removed) {
    for (const appeared of added) {
      if (dequal(shapeOf(before[gone]), shapeOf(after[appeared])))
        found.push({ removed: gone, added: appeared });
    }
  }
  const was = Object.keys(before);
  const now = Object.keys(after);
  const apart = ({ removed: gone, added: appeared }: RenameCandidate): number =>
    Math.abs(now.indexOf(appeared) - was.indexOf(gone));

  return found.sort((a, b) => apart(a) - apart(b));
}
