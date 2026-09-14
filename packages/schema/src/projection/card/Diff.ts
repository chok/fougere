import { dequal } from 'dequal';
import { EXTENSION_SLOTS } from '../../axis/Axis.js';
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
  const changes: Change[] = [];
  const renamed = options.renamed ?? {};
  const before = was.properties ?? {};
  const after = is.properties ?? {};
  const requiredBefore = new Set(was.required ?? []);
  const requiredAfter = new Set(is.required ?? []);

  // Apply a declared rename first so subsequent differences use the new field name.
  const nameAfter = (field: string): string => renamed[field] ?? field;
  const removed: string[] = [];
  for (const [field, descriptor] of Object.entries(before)) {
    const now = nameAfter(field);
    const target = after[now];
    if (target === undefined) {
      removed.push(field);
      continue;
    }

    if (now !== field)
      changes.push({ kind: 'renamed', from: field, to: now, field: target });

    const wasType = typesOf(descriptor);
    const isType = typesOf(target);
    if (!dequal(wasType, isType))
      changes.push({ kind: 'retyped', field: now, from: wasType, to: isType });
    else if (!dequal(boundsOf(descriptor), boundsOf(target))) {
      changes.push({ kind: 'reshaped', field: now, from: descriptor, to: target });
    }

    const wasRequired = requiredBefore.has(field);
    const isRequired = requiredAfter.has(now);
    if (wasRequired !== isRequired) {
      changes.push({ kind: 'required', field: now, from: wasRequired, to: isRequired });
    }
    changes.push(...restated(now, descriptor['x-fougere'], target['x-fougere']));
  }

  const claimed = new Set(Object.values(renamed));
  const added = Object.keys(after).filter(
    (field) => !(field in before) && !claimed.has(field),
  );
  for (const field of removed) {
    changes.push({
      kind: 'removed',
      field,
      from: before[field],
      required: requiredBefore.has(field),
    });
  }
  for (const field of added) {
    changes.push({
      kind: 'added',
      field,
      to: after[field],
      required: requiredAfter.has(field),
    });
  }

  return { changes, ambiguous: candidates(removed, added, before, after) };
}

function restated(
  field: string,
  before: FieldExtension | undefined,
  after: FieldExtension | undefined,
): Change[] {
  return EXTENSION_SLOTS.filter((axis) => !dequal(before?.[axis], after?.[axis])).map(
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
  const type = descriptor.type;
  if (type === undefined) return [];
  return (Array.isArray(type) ? [...type] : [type]).sort();
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
