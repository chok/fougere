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
import { statesModule, type FrondsStated } from '../FrondsStated.js';
import { statedFronds } from '../StatedFrond.js';

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

  const statements = statedFronds(stated);
  const here = new Map(fronds.map((frond) => [frond.name, frond]));
  const childrenOf = new Map<string, string[]>();
  const inherits = new Set<string>();
  for (const statement of statements) {
    if (statement.extends === undefined) continue;

    inherits.add(statement.key);
    childrenOf.set(statement.extends, [...(childrenOf.get(statement.extends) ?? []), statement.key]);
  }

  for (const statement of statements) {
    if (statement.extends === undefined || !inherits.has(statement.extends)) continue;

    refused.push({
      severity: 'blocking',
      code: 'frond-extends-chain',
      filePath: 'fougere.config.ts',
      subject: statement.path,
      message: `'${statement.key}' inherits from '${statement.extends}', which inherits from `
        + `'${statedFronds(stated).find((one) => one.key === statement.extends)?.extends}'. `
        + 'Inheriting goes one level: a scope hangs off the one above it, and a chain would make '
        + 'a frond depend on code its own family never named. Move what they share into one '
        + 'frond they both inherit from.',
    });
  }

  // A frond a family inherits from needs no entry of its own — `extends` is said by the
  // inheritor — so what it may not be is asked of the NAMES, not of the entries.
  for (const [parent, children] of childrenOf) {
    const frond = here.get(parent);
    if (frond === undefined) continue;

    const placed = stated[parent];
    const address = typeof placed === 'string' ? placed : placed?.remote;
    if (address !== undefined || (remotes && parent in remotes)) {
      refused.push({
        severity: 'blocking',
        code: 'frond-parent-remote',
        filePath: frond.source.path,
        frond: frond.name,
        subject: parent,
        message: `'${parent}' is inherited from by ${children.join(', ')} and is placed at `
          + `${address ?? remotes?.[parent]}. A frond they inherit from stands in every process `
          + 'that holds one of them, so it has no address of its own. Give the address to one of '
          + 'them, or have them inherit from somewhere else.',
      });
    }

    if (!refuseServingParent(frond, children, refused)) refuseParentEntities(frond, children, refused);
  }

  for (const statement of statements) {
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

    if (statement.extends !== undefined && !here.has(statement.extends)) {
      refused.push({
        severity: 'blocking',
        code: 'frond-family-split',
        filePath: frond.source.path,
        frond: frond.name,
        subject: statement.path,
        message: `'${statement.key}' inherits from '${statement.extends}', which this process does `
          + 'not carry. A frond cannot leave the code it resolves behind — carry the two '
          + `together, or take '${statement.key}' out from under '${statement.extends}'.`,
      });
      continue;
    }

    if (statement.extends !== undefined) under.set(statement.key, statement.extends);
  }

  return { under, refused };
}

/**
 * The same fronds, each parent before the ones inheriting from it — the order the boot installs
 * them in, since a scope hangs off the one above it.
 *
 * A partition and not a sort: inheriting goes one level, so a frond that inherits has nothing
 * under it and two passes are enough. Stable, and the same array when nothing inherits — which
 * is what `orderSeeds` reads.
 */
export function parentsFirst(fronds: Fronds, under: Map<string, string>): Fronds {
  if (under.size === 0) return fronds;

  return Fronds.hosting([
    ...fronds.filter((frond) => !under.has(frond.name)),
    ...fronds.filter((frond) => under.has(frond.name)),
  ]);
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
    if (parent !== undefined) frond.extends = parent;
  }

  return parentsFirst(fronds, under);
}
