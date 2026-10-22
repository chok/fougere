/**
 * Who inherits code from whom, read off `FougereConfig.fronds` and judged before anything is
 * built. It reads no disk and holds no container: the scopes it decides are built later, in
 * `install.ts`, and everything here is a fact about names.
 *
 * Documented: [fronds](https://fougere.dev/docs/infra/fronds).
 */
import type { Diagnostic } from '../diagnostic.js';
import { frondPackage, resolveConventions, type Conventions } from '../Conventions.js';
import { isFrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { Fronds } from '../descriptor/Fronds.js';
import { statesModule, type FrondEntries } from '../FrondEntries.js';
import { keyedFrondEntries } from '../KeyedFrondEntry.js';

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
    message: `The frond '${parent.name}' is extended by ${children.map((one) => `'${one}'`).join(', ')}, so it cannot have handlers (${served.join(', ')}). `
      + 'Move its handlers into one of them.',
  });

  return true;
}

/** Rows belong to a frond something can call — the family case is not traced, so it is refused. */
function refuseParentEntities(
  parent: FrondDescriptor,
  children: string[],
  refused: Diagnostic[],
  conventions: Conventions,
): void {
  if (parent.entities.length === 0) return;

  refused.push({
    severity: 'blocking',
    code: 'frond-parent-entities',
    filePath: parent.entities[0]!.filePath,
    frond: parent.name,
    subject: parent.name,
    message: `The frond '${parent.name}' is extended by ${children.map((one) => `'${one}'`).join(', ')}, so it cannot have entities `
      + `(${parent.entities.map((entity) => entity.name).join(', ')}). Move them into one of them, `
      + `and import them from there: import X from '${frondPackage(children[0]!, conventions)}/${conventions.dirs.entities}/X.js'.`,
  });
}

/** What the tree says, against what this process actually holds. */
export function nestingOf(
  entries: FrondEntries | undefined,
  fronds: Fronds,
  remotes: Record<string, string> | undefined,
  /** This process carries a subset of the project — `only:`, so an absent name is expected. */
  narrowed = false,
  conventions: Conventions = resolveConventions(),
): { under: Map<string, string>; refused: Diagnostic[] } {
  const refused: Diagnostic[] = [];
  const under = new Map<string, string>();
  if (entries === undefined) return { under, refused };

  const statements = keyedFrondEntries(entries);
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
      message: `The frond '${statement.key}' extends '${statement.extends}', which extends `
        + `'${keyedFrondEntries(entries).find((one) => one.key === statement.extends)?.extends}'. `
        + 'A frond can extend only one level. Move what they share into the frond they both extend.',
    });
  }

  // A frond a family inherits from needs no entry of its own — `extends` is said by the
  // inheritor — so what it may not be is asked of the NAMES, not of the entries.
  for (const [parent, children] of childrenOf) {
    const frond = here.get(parent);
    if (frond === undefined) continue;

    const placed = entries[parent];
    const address = typeof placed === 'string' ? placed : isFrondDescriptor(placed) ? undefined : placed?.remote;
    if (address !== undefined || (remotes && parent in remotes)) {
      refused.push({
        severity: 'blocking',
        code: 'frond-parent-remote',
        filePath: frond.source.path,
        frond: frond.name,
        subject: parent,
        message: `The frond '${parent}' is extended by ${children.map((one) => `'${one}'`).join(', ')}, so it cannot have an address `
          + `(${address ?? remotes?.[parent]}). Give the address to one of them instead.`,
      });
    }

    if (!refuseServingParent(frond, children, refused)) refuseParentEntities(frond, children, refused, conventions);
  }

  for (const statement of statements) {
    const frond = here.get(statement.key);

    if (frond === undefined) {
      // Three ways a stated name is absent from this process and says nothing wrong: a module
      // key, which the host imports; an address, whose frond answers elsewhere by definition;
      // and a frond `only:` left out, since the config describes the PROJECT and the flag one
      // process. What is left is a name nothing carries — a typo, and the config is where it
      // was made, so that is where the message points.
      const placedRemotely = statement.value !== undefined || (remotes && statement.key in remotes);
      if (!statesModule(statement.key) && !placedRemotely && here.size > 0 && !narrowed) {
        refused.push({
          severity: 'blocking',
          code: 'frond-unknown',
          filePath: 'fougere.config.ts',
          subject: statement.path,
          message: `No frond is named '${statement.path}'. This project has: ${[...here.keys()].map((one) => `'${one}'`).join(', ') || 'none'}.`,
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
        message: `The frond '${statement.key}' extends '${statement.extends}', which this process leaves out. `
          + `Run the two in the same process, or remove extends: '${statement.extends}'.`,
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

  return Fronds.list([
    ...fronds.filter((frond) => !under.has(frond.name)),
    ...fronds.filter((frond) => under.has(frond.name)),
  ]);
}

/**
 * The same `under` a boot stamps, for a reader that does not boot — `fougere check` and
 * `fougere explain` resolve the model off a scan, and a scan knows nothing of the tree.
 * Without it they report every inherited dependency as a crossing.
 */
export function nested(fronds: Fronds, entries: FrondEntries | undefined): Fronds {
  const { under } = nestingOf(entries, fronds, undefined, true);
  for (const frond of fronds) {
    const parent = under.get(frond.name);
    if (parent !== undefined) frond.extends = parent;
  }

  return parentsFirst(fronds, under);
}
