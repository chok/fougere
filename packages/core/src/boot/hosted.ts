/**
 * What this app hosts — what it STATED, or what a scan FOUND.
 *
 * The PRESENCE of the key is the decision, the way `remotes:` states a topology: an app
 * that passes `fronds:` is saying "do not scan", and one that passes `scan:` is handing
 * over what a scanner read. There is no mode to configure because there is no third
 * behaviour to name.
 *
 * Both may arrive, and then they MERGE — but only where a scan costs nothing at runtime.
 * Under Nuxt the scan is a build artifact, so an app may state the frond it wants to own
 * and leave the rest to what the build found. Anywhere the scan would run at START, half a
 * statement buys nothing the whole one does: the disk is read either way.
 *
 * Merging is per frond NAME and per member. A stated frond wins outright on the members it
 * names — stating `entities: [Post]` where a scan found `[Post, Author]` yields `[Post]`,
 * because the point of stating is to decide. Empty is what "I named none" looks like, and
 * `frond()` builds every member, so an empty one is filled rather than enforced.
 */
import type { FrondDescriptor } from '../descriptor/frond.js';
import type { ScanResult } from '../scan/result.js';
import { Fronds } from '../descriptor/Fronds.js';

/** Where an app's fronds come from — either, or both. */
export interface HostedSources {
  /** What the app states. No disk was read, so no diagnostic can come from it. */
  fronds?: readonly FrondDescriptor[];
  /** What a scanner found, and what it could not do. */
  scan?: ScanResult | (() => Promise<ScanResult> | ScanResult);
}

/** The members a stated frond takes from a scan when it named none of its own. */
type Fillable = 'providers' | 'entities' | 'handlers' | 'presenters' | 'collectors' | 'seeds';

/** A stated frond, completed by what a scan found under the same name. */
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

/**
 * What the app hosts, and what the scan — if it ran — could not do.
 *
 * Neither key is EMPTY rather than refused: whether an app with no frond is legitimate
 * depends on what else it declares, and this function is handed none of that.
 */
export async function hostedBy(sources: HostedSources): Promise<ScanResult> {
  const scanned = sources.scan
    ? await (typeof sources.scan === 'function' ? sources.scan() : sources.scan)
    : undefined;

  if (!sources.fronds) return scanned ?? { fronds: Fronds.hosting([]), diagnostics: [] };

  const found = scanned?.fronds ?? [];
  const configured = sources.fronds.map((f) => completed(f, found.find((s) => s.name === f.name)));
  const discovered = found.filter((f) => !sources.fronds!.some((s) => s.name === f.name));

  return { fronds: Fronds.hosting([...configured, ...discovered]), diagnostics: scanned?.diagnostics ?? [] };
}
