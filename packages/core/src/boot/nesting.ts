/**
 * Who inherits code from whom, read off `FougereConfig.fronds` and judged before anything is
 * built. It reads no disk and holds no container: the scopes it decides are built later, in
 * `install.ts`, and everything here is a fact about names.
 *
 * Documented: [fronds](https://fougere.dev/docs/infra/fronds).
 */
import type { Diagnostic } from '../diagnostic.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { Fronds } from '../descriptor/Fronds.js';
import { statedFronds, statesModule, type FrondsStated } from '../FrondsStated.js';

/** A frond that holds what a family shares serves nothing — which is what keeps it here. */
function refuseServingParent(
  parent: FrondDescriptor,
  children: string[],
  refused: Diagnostic[],
): boolean {
  if (parent.handlers.length === 0) return false;

  const served = [...new Set(parent.handlers.map((handler) => handler.address))];
  refused.push({
    severity: 'blocking',
    code: 'frond-parent-serves',
    filePath: parent.handlers[0]!.filePath,
    frond: parent.name,
    subject: parent.name,
    message: `'${parent.name}' has children (${children.join(', ')}) and answers at `
      + `${served.join(', ')}. A frond its family inherits from holds the code they share and `
      + 'nothing else — with no façade, nothing can call it and nothing can place it elsewhere. '
      + 'Move its handlers into a child, or take the children out.',
  });

  return true;
}

/** Rows belong to a frond something can call — the family case is not traced, so it is refused. */
function refuseParentEntities(
  parent: FrondDescriptor,
  children: string[],
  refused: Diagnostic[],
): void {
  if (parent.entities.length === 0) return;

  refused.push({
    severity: 'blocking',
    code: 'frond-parent-entities',
    filePath: parent.entities[0]!.filePath,
    frond: parent.name,
    subject: parent.name,
    message: `'${parent.name}' has children (${children.join(', ')}) and declares `
      + `${parent.entities.map((entity) => entity.name).join(', ')}. A frond they inherit from `
      + 'holds code, not rows. Declare the entity in a child and import it from there — '
      + `\`import X from '@fronds/<child>/entities/X.js'\` reaches it from anywhere.`,
  });
}

/** What the tree says, against what this process actually holds. */
export function nestingOf(
  stated: FrondsStated | undefined,
  fronds: Fronds,
  remotes: Record<string, string> | undefined,
  /** This process carries a subset of the project — `only:`, so an absent name is expected. */
  narrowed = false,
): { under: Map<string, string>; refused: Diagnostic[] } {
  const refused: Diagnostic[] = [];
  const under = new Map<string, string>();
  if (stated === undefined) return { under, refused };

  const { fronds: statements, twice } = statedFronds(stated);
  const here = new Map(fronds.map((frond) => [frond.name, frond]));
  const childrenOf = new Map<string, string[]>();
  for (const statement of statements) {
    if (statement.under === undefined) continue;
    childrenOf.set(statement.under, [...(childrenOf.get(statement.under) ?? []), statement.key]);
  }

  for (const { key, paths } of twice) {
    refused.push({
      severity: 'blocking',
      code: 'frond-under-twice',
      filePath: 'fougere.config.ts',
      subject: key,
      message: `'${key}' is stated at ${paths[0]} and at ${paths[1]}. A frond inherits from one `
        + 'place: two would make the service it resolves depend on reading order. This can only '
        + 'come from a cascade — check the workspace config beside the app one.',
    });
  }

  for (const statement of statements) {
    const children = childrenOf.get(statement.key);
    const frond = here.get(statement.key);

    if (frond === undefined) {
      // Three ways a stated name is absent from this process and says nothing wrong: a module
      // key, which the host imports; an address, whose frond answers elsewhere by definition;
      // and a frond `only:` left out, since the config describes the PROJECT and the flag one
      // process. What is left is a name nothing carries — a typo, and the config is where it
      // was made, so that is where the message points.
      const elsewhere = statement.value !== undefined || (remotes && statement.key in remotes);
      if (!statesModule(statement.key) && !elsewhere && here.size > 0 && !narrowed) {
        refused.push({
          severity: 'blocking',
          code: 'frond-unknown',
          filePath: 'fougere.config.ts',
          subject: statement.path,
          message: `'${statement.path}' names no frond this project holds. It has `
            + `${[...here.keys()].join(', ') || 'none'}. Check the spelling, or drop the entry.`,
        });
      }
      continue;
    }

    if (statement.under !== undefined && !here.has(statement.under)) {
      refused.push({
        severity: 'blocking',
        code: 'frond-family-split',
        filePath: frond.source.path,
        frond: frond.name,
        subject: statement.path,
        message: `'${statement.key}' inherits from '${statement.under}', which this process does `
          + 'not carry. A frond cannot leave the code it resolves behind — carry the two '
          + `together, or take '${statement.key}' out from under '${statement.under}'.`,
      });
      continue;
    }

    if (children === undefined) {
      if (statement.under !== undefined) under.set(statement.key, statement.under);
      continue;
    }

    if (statement.value !== undefined || (remotes && statement.key in remotes)) {
      refused.push({
        severity: 'blocking',
        code: 'frond-parent-remote',
        filePath: frond.source.path,
        frond: frond.name,
        subject: statement.path,
        message: `'${statement.key}' has children (${children.join(', ')}) and is placed at `
          + `${statement.value ?? remotes?.[statement.key]}. A frond they inherit from stands in `
          + 'every process that holds one of them, so it has no address of its own. Give the '
          + 'address to a child, or take the children out.',
      });
    }

    if (!refuseServingParent(frond, children, refused)) refuseParentEntities(frond, children, refused);
    if (statement.under !== undefined) under.set(statement.key, statement.under);
  }

  return { under, refused };
}

/**
 * The same fronds, each parent before the children that inherit from it — the order the boot
 * installs them in, since a child's scope hangs off its parent's.
 *
 * Stable: a frond only moves when another one is under it, so a flat app keeps the order it
 * was given, which is what `orderSeeds` reads.
 */
export function parentsFirst(fronds: Fronds, under: Map<string, string>): Fronds {
  if (under.size === 0) return fronds;

  const placed = new Set<string>();
  const byName = new Map(fronds.map((frond) => [frond.name, frond]));
  const ordered: FrondDescriptor[] = [];

  const place = (frond: FrondDescriptor): void => {
    if (placed.has(frond.name)) return;

    placed.add(frond.name);
    const parent = under.get(frond.name);
    const above = parent !== undefined ? byName.get(parent) : undefined;
    if (above) place(above);
    ordered.push(frond);
  };

  for (const frond of fronds) place(frond);

  return Fronds.hosting(ordered);
}

/**
 * The same `under` a boot stamps, for a reader that does not boot — `fougere check` and
 * `fougere explain` resolve the model off a scan, and a scan knows nothing of the tree.
 * Without it they report every inherited dependency as a crossing.
 */
export function nested(fronds: Fronds, stated: FrondsStated | undefined): Fronds {
  const { under } = nestingOf(stated, fronds, undefined, true);
  for (const frond of fronds) {
    const parent = under.get(frond.name);
    if (parent !== undefined) frond.under = parent;
  }

  return parentsFirst(fronds, under);
}
