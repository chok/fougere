import { createHttpTransport } from '@fougere/transport-http/client';
import type { CallPage, CallRecord } from '@fougere/core';
import ProjectScan from '../services/ProjectScan.js';

/** The default address of an app in development — Nuxt, Next and the site all sit there. */
const LOCAL = 'http://127.0.0.1:3000';

/** One address that was asked, and what came back from it. */
export interface CallSource {
  url: string;
  /** The frond `remotes:` names at this address, when that is where it came from. */
  frond?: string;
  cursor: number;
  inFlight: number;
  dropped: number;
  /** Present instead of the numbers when the address did not answer, or serves no log. */
  refusal?: string;
}

/**
 * Every app of this project, read at once.
 *
 * A reader pulls: no app registers anywhere, and an app started alone depends on nothing.
 * The price is knowing the addresses, which the project already states — `remotes:` says
 * where a call goes, so it also says where the other half of a call can be watched.
 */
export interface CallsView {
  sources: CallSource[];
  /** Every call, oldest first, each carrying the address it was read from. */
  calls: (CallRecord & { source: string })[];
}

export default class DevtoolsHandler {
  constructor(private projectScan: ProjectScan) {}

  /** Read what the running apps have dispatched since a cursor per address. */
  async execute(input: { url?: string; root?: string; since?: Record<string, number> }): Promise<CallsView> {
    const asked = input.url ? [{ url: trimmed(input.url) }] : await this.addresses(input.root);
    const since = input.since ?? {};

    const read = await Promise.all(asked.map(async (one): Promise<CallSource & { calls: CallRecord[] }> => {
      try {
        const page = await createHttpTransport(one.url)(
          { entity: 'rpc', op: 'calls' },
          { params: {}, query: {}, body: { since: since[one.url] ?? 0 }, state: {} },
        ) as CallPage;

        return { ...one, cursor: page.cursor, inFlight: page.inFlight, dropped: page.dropped, calls: page.calls };
      } catch (err) {
        // An address that does not answer is a source with a reason, not a missing source:
        // an app not started and an app without the package are different facts, and both
        // are worth seeing beside the ones that answered.
        return { ...one, cursor: since[one.url] ?? 0, inFlight: 0, dropped: 0, calls: [], refusal: said(err) };
      }
    }));

    return {
      sources: read.map(({ calls: _calls, ...source }) => source),
      calls: read
        .flatMap(({ url, calls }) => calls.map((call) => ({ ...call, source: url })))
        .sort((a, b) => a.startedAt - b.startedAt || a.seq - b.seq),
    };
  }

  /**
   * The addresses this project declares, plus the local one.
   *
   * `remotes:` is the operator's statement of where a call goes; reading it here is not a
   * second source of truth, it is the same one read for the other direction.
   */
  private async addresses(root?: string): Promise<{ url: string; frond?: string }[]> {
    const { config } = await this.projectScan.at(root);
    const remotes = Object.entries(config.remotes ?? {})
      .map(([frond, url]) => ({ url: trimmed(url), frond }));

    return [{ url: LOCAL }, ...remotes.filter((one) => one.url !== LOCAL)];
  }
}

function trimmed(url: string): string {
  return url.replace(/\/$/, '');
}

function said(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
