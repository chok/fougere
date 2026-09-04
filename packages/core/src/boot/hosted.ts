/** What this app hosts — what it STATED, or what a scan FOUND. */
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

/** The members a frond takes from a scan when it named none of its own. */
type Fillable = 'providers' | 'entities' | 'handlers' | 'presenters' | 'collectors' | 'seeds';

/** A frond the host passed, completed by what a scan found under the same name. */
function completed(given: FrondDescriptor, found: FrondDescriptor | undefined): FrondDescriptor {
  if (!found) return given;

  // Written out rather than looped: a loop over the key union asks TypeScript to prove
  // `found[k]` fits `given[k]` for every k at once, which it cannot — and the cast that
  // silences it would also silence a member added to the descriptor and forgotten here.
  const fill = <K extends Fillable>(member: K): FrondDescriptor[K] =>
    (given[member].length === 0 ? found[member] : given[member]);

  return {
    ...found,
    ...given,
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

  if (!sources.fronds) return scanned ?? { fronds: Fronds.hosting([]), diagnostics: [] };

  const found = scanned?.fronds ?? [];
  const configured = sources.fronds.map((f) => completed(f, found.find((s) => s.name === f.name)));
  const discovered = found.filter((f) => !sources.fronds!.some((s) => s.name === f.name));

  return { fronds: Fronds.hosting([...configured, ...discovered]), diagnostics: scanned?.diagnostics ?? [] };
}
