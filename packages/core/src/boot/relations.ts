/** Who holds a `ref()`: the source it lives in, this process, or nobody. */
import { lowerFirst, Role, Shapes, type SchemaView } from '@fougere/schema';
import type { Dependent } from '../dispatch/Dependent.js';
import type { RelationCheck } from '../dispatch/RelationCheck.js';
import type { Hosting } from './Hosting.js';
import type { Diagnostic } from '../diagnostic.js';
import type { Releasing, Rows } from '../dispatch/Release.js';

/**
 * Does a foreign key hold this reference? Both sides in ONE source that keeps relations — two
 * databases share no constraint, and a frond behind `remotes:` registers no storage here at
 * all. So the PAIR decides, never the engine.
 *
 * And the pair is not enough: an engine's cascade does not pass through the guard, so a hop it
 * owns above a hop it does not would take rows out with nothing left to release THEIR rows. One
 * unkeyed hop anywhere below and the guard takes the whole tree — the engine's own cascade then
 * finds nothing left to do, since the guard walks deepest first and the row goes last.
 */
function keyed(namer: string, target: string, hosting: Hosting, seen = new Set<string>()): boolean {
  const pair = hosting.hostedHere(namer)
    && hosting.hostedHere(target)
    && hosting.sourceOf(namer) === hosting.sourceOf(target)
    && hosting.enforces(hosting.sourceOf(namer), 'relation');
  if (!pair || seen.has(namer)) return pair;
  seen.add(namer);

  return referencesTo(namer, hosting).every(({ entity }) => keyed(entity, namer, hosting, seen));
}

/** Every field of every entity that names `target` — read over the whole app, both ways need it. */
function referencesTo(target: string, hosting: Hosting): { entity: string; field: string; role: Role }[] {
  const found: { entity: string; field: string; role: Role }[] = [];

  for (const [entity, schema] of hosting.entities()) {
    for (const [field, declared] of Object.entries(schema.getFields())) {
      const role = Role.of(declared);
      if (role.isReference && role.target?.name && lowerFirst(role.target.name) === target) {
        found.push({ entity, field, role });
      }
    }
  }

  return found;
}

/** What a target's storage has to answer for a key set to be judged in one read. */
interface ByKeys {
  findByKeys(keys: readonly string[]): Promise<Map<string, unknown>>;
}

/**
 * The references a foreign key cannot hold, each as a read the guard makes before the write.
 *
 * Documented: [entities](https://fougere.dev/docs/schema/entities).
 */
export function heldBy(entity: SchemaView, name: string, hosting: Hosting): RelationCheck[] {
  const checks: RelationCheck[] = [];

  for (const [field, declared] of Object.entries(entity.getFields())) {
    const role = Role.of(declared);
    if (!role.isReference || !role.target?.name) continue;

    const target = lowerFirst(role.target.name);
    if (keyed(name, target, hosting)) continue;

    checks.push({
      field,
      target,
      missing: async (keys) => {
        const storage = hosting.storageOf(target) as ByKeys | undefined;
        // Nothing here holds those rows — the process that does answers the same reading,
        // so the question crosses rather than being given up on.
        if (!storage) return hosting.peerOf(target)?.missing(target, keys) ?? [];
        const found = await storage.findByKeys(keys.map(String));

        return keys.filter((key) => !found.has(String(key)));
      },
    });
  }

  return checks;
}

/**
 * The rows that name this entity's, and what becomes of them — the dual of `heldBy`.
 *
 * Read over EVERY entity of the app, because a namer is declared wherever its own frond is,
 * and the target learns of it from nowhere else. What a key already holds is left out: the
 * engine answers it at the rows, inside the delete's own transaction.
 *
 * Documented: [entities](https://fougere.dev/docs/schema/entities).
 */
export function dependentsOf(target: string, hosting: Hosting): Dependent[] {
  return referencesTo(target, hosting)
    .filter(({ entity }) => !keyed(entity, target, hosting))
    .map(({ entity, field, role }) => ({ entity, field, onDelete: role.onDelete ?? 'restrict' }));
}

/**
 * `set null` on a field that may not hold one — refused where the FIELD is, not in `ref()`.
 *
 * `optional()` wraps a `ref()` and is applied after it, so only the field the entity ended up
 * declaring knows whether null is admitted. Asked here rather than at the target, because the
 * declaration is the namer's and so is the fix.
 */
export function refuseUnwritableNull(entity: SchemaView, name: string, filePath: string): Diagnostic[] {
  const refused: Diagnostic[] = [];

  for (const [field, declared] of Object.entries(entity.getFields())) {
    if (Role.of(declared).onDelete !== 'set null' || Shapes.isNullable(declared.shape)) continue;
    refused.push({
      severity: 'blocking',
      code: 'on-delete-null-refused',
      filePath,
      subject: `${name}.${field}`,
      message: `${name}.${field} states onDelete 'set null', and the field admits no null — so the `
        + 'row could neither be emptied nor kept. Wrap it in `optional()`, or state `cascade` '
        + 'to take the row out with its target.',
    });
  }

  return refused;
}

/** The checks nothing in this process can answer — asked once every frond has registered. */
export function unheldAmong(checks: readonly RelationCheck[], hosting: Hosting): string[] {
  return checks
    .filter((check) => hosting.storageOf(check.target) === undefined)
    .map((check) => `${check.field} → ${check.target}`);
}

/**
 * What a release asks the boot, built once per app — the same `Hosting` the guard reads.
 *
 * `dependentsOf` is answered per call rather than cached: a frond installed after this one
 * brings rows that name an entity already registered, and a table taken at boot would miss
 * exactly the crossings this exists for.
 */
export function releasing(hosting: Hosting): Releasing {
  return {
    dependentsOf: (entity) => dependentsOf(entity, hosting),
    rowsOf: (entity) => hosting.storageOf(entity) as Rows | undefined,
    schemaOf: (entity) => hosting.entities().get(entity),
    peers: () => hosting.peers(),
    journal: (entity) => hosting.journal(entity),
  };
}
