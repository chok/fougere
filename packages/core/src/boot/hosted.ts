/**
 * What this app hosts, from what it STATED and what a scan FOUND.
 *
 * The order is the one `effectiveOperation` already applies one level down, for the same
 * reason: a statement made by whoever assembles the app beats a reading made about it.
 * Here it has two members instead of three —
 *
 *   1. `fronds:` — what the app states. Classes it imported, so nothing could fail to
 *      resolve and there is nothing to report.
 *   2. `scan:` — what a scanner found on a disk, with what it could not do.
 *
 * The PRESENCE of each key is the decision, the way `remotes:` states a topology: an app
 * that passes only `fronds:` is saying "do not scan", and one that passes both is saying
 * "fill in what I did not name". Neither is a mode to configure — there is no third
 * behaviour to spell, so there is no enum.
 *
 * Merging is per frond NAME and per member. A stated frond wins outright on the members
 * it names: stating `entities: [Post]` where a scan found `[Post, Author]` yields `[Post]`,
 * because the point of stating is to decide. Members left unstated come from the scan.
 */
import { Fronds } from '../scan/Fronds.js';
import type { FrondDescriptor, ScanDiagnostic, ScanResult } from '../scan/frond.js';

/** Where an app's fronds come from — at least one, in this order of authority. */
export interface HostedSources {
  /** What the app states. No disk was read, so no diagnostic can come from it. */
  fronds?: readonly FrondDescriptor[];
  /** What a scanner found, and what it could not do. */
  scan?: ScanResult | (() => Promise<ScanResult> | ScanResult);
}

/** The members a stated frond may take from a scan when it did not name them. */
type Fillable = 'providers' | 'entities' | 'handlers' | 'presenters' | 'collectors' | 'seeds';

/**
 * A stated frond, completed by what the scan found under the same name.
 *
 * Emptiness is the test, not presence: `frond('blog', { entities: [Post] })` builds every
 * member, so `handlers: []` is what "I named no handler" looks like and there is no way to
 * distinguish it from "I named none on purpose". Deciding that an empty list means "fill
 * it" is the reading that makes `{ fronds, scan }` useful at all — an app that wants a
 * member empty passes no scan.
 */
function completed(stated: FrondDescriptor, found: FrondDescriptor | undefined): FrondDescriptor {
  if (!found) return stated;

  // Written out rather than looped: a loop over the key union asks TypeScript to prove
  // `found[k]` fits `stated[k]` for every k at once, which it cannot — and the cast that
  // silences it would also silence a member added to the descriptor and forgotten here.
  const fill = <K extends Fillable>(member: K): FrondDescriptor[K] =>
    (stated[member].length === 0 ? found[member] : stated[member]);

  return {
    ...found,
    ...stated,
    providers: fill('providers'),
    entities: fill('entities'),
    handlers: fill('handlers'),
    presenters: fill('presenters'),
    collectors: fill('collectors'),
    seeds: fill('seeds'),
  };
}

/** What the app hosts, and what the scan — if it ran — could not do. */
export async function hostedBy(sources: HostedSources): Promise<ScanResult> {
  const scanned = sources.scan
    ? await (typeof sources.scan === 'function' ? sources.scan() : sources.scan)
    : undefined;

  if (!sources.fronds) {
    if (!scanned) {
      throw new Error(
        'createApp needs `fronds:` (what this app states) or `scan:` (what a scanner found). '
        + 'Neither was given, so nothing is hosted.',
      );
    }

    return scanned;
  }

  const found = scanned?.fronds ?? [];
  const stated = sources.fronds.map((f) => completed(f, found.find((s) => s.name === f.name)));
  const unstated = found.filter((f) => !sources.fronds!.some((s) => s.name === f.name));
  const diagnostics: ScanDiagnostic[] = scanned?.diagnostics ?? [];

  return { fronds: Fronds.scanned([...stated, ...unstated]), diagnostics };
}
