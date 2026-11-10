import type { Diagnostic } from '../diagnostic.js';
import { frondPackage, resolveConventions, type Conventions } from '../config/Conventions.js';
import { isFrondDescriptor } from '../descriptor/FrondDescriptor.js';
import type { FrondDescriptor } from '../descriptor/FrondDescriptor.js';
import { Fronds } from '../descriptor/Fronds.js';
import { statesModule, type FrondEntries } from '../config/FrondEntries.js';
import { keyedFrondEntries } from '../config/KeyedFrondEntry.js';

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

function refuseParentEntities(
  parent: FrondDescriptor,
  children: string[],
  refused: Diagnostic[],
  conventions: Conventions,
  valued: (entity: string) => boolean,
): void {
  const rows = parent.entities.filter((entity) => !valued(entity.name));
  if (rows.length === 0) return;

  refused.push({
    severity: 'blocking',
    code: 'frond-parent-entities',
    filePath: rows[0]!.filePath,
    frond: parent.name,
    subject: parent.name,
    message: `The frond '${parent.name}' is extended by ${children.map((one) => `'${one}'`).join(', ')}, so it cannot have entities `
      + `(${rows.map((entity) => entity.name).join(', ')}). Move them into one of them, `
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
  /** Held as one value, which a frond a family inherits from may keep. */
  valued: (entity: string) => boolean = () => false,
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

    if (!refuseServingParent(frond, children, refused)) refuseParentEntities(frond, children, refused, conventions, valued);
  }

  for (const statement of statements) {
    const frond = here.get(statement.key);

    if (frond === undefined) {
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

/** The same fronds, each parent before the ones inheriting from it. */
export function parentsFirst(fronds: Fronds, under: Map<string, string>): Fronds {
  if (under.size === 0) return fronds;

  return Fronds.list([
    ...fronds.filter((frond) => !under.has(frond.name)),
    ...fronds.filter((frond) => under.has(frond.name)),
  ]);
}

/** The tree a boot stamps, for a reader that does not boot. */
export function nested(fronds: Fronds, entries: FrondEntries | undefined): Fronds {
  const { under } = nestingOf(entries, fronds, undefined, true);
  for (const frond of fronds) {
    const parent = under.get(frond.name);
    if (parent !== undefined) frond.extends = parent;
  }

  return parentsFirst(fronds, under);
}
