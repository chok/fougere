/**
 * How the system is arranged, as the app itself reports it.
 *
 * The card answers what a process HOSTS; this answers what SHAPE it is in — which fronds
 * run here, which answered from somewhere else, and who called whom. It is served by
 * `@fougere/observability` on `rpc.topology`, so absence is an ordinary answer: an app
 * that never installed the package has no topology to publish, and says so by refusing
 * the op. Nothing here is declared — a frond is remote because it answered a call nobody
 * hosts, never because a config line said so.
 */
import {
  CALL_ENDPOINT,
  fetcher as browserFetcher,
  sendCall,
  type Fetcher,
} from '@fougere/app/client';
import {
  EMPTY_INVOCATION,
  ErrorCode,
  type Edge,
  type FrondPlacement,
  type TopologyReport,
} from '@fougere/core/contract';

export type { TopologyReport, FrondPlacement, Edge };

/**
 * The report, or `undefined` when the app serves no topology at all.
 *
 * The refusal is DISTINGUISHED, not swallowed: a `NOT_FOUND` on the op is the package not
 * being wired — something the panel can explain — while anything else is a real failure
 * and stays a failure. One reserved op that is absent must not read as an app that is down.
 */
export async function fetchTopology(
  endpoint = CALL_ENDPOINT,
  fetcher: Fetcher = browserFetcher,
): Promise<TopologyReport | undefined> {
  try {
    return await sendCall(
      fetcher,
      { entity: 'rpc', op: 'topology' },
      EMPTY_INVOCATION,
      endpoint,
    ) as TopologyReport;
  } catch (error) {
    if ((error as { code?: unknown })?.code === ErrorCode.NOT_FOUND) return undefined;
    throw error;
  }
}

/** One frond as the page draws it: its placement, and the calls observed around it. */
export interface TopologyNode extends FrondPlacement {
  /** Fronds this one called, with what it cost them. */
  calls: Edge[];
  /** Fronds that called this one. */
  calledBy: Edge[];
}

/**
 * The report read as a graph, local fronds first.
 *
 * Two passes over `edges` rather than one index per direction: a topology is bounded by
 * fronds², so the whole thing is smaller than one page of rows and an index would be a
 * second structure to keep true.
 */
export function nodesOf(report: TopologyReport): TopologyNode[] {
  const order = { local: 0, remote: 1 };
  return [...report.fronds]
    .sort((a, b) => order[a.placement] - order[b.placement] || a.frond.localeCompare(b.frond))
    .map((frond) => ({
      ...frond,
      calls: report.edges.filter((edge) => edge.from === frond.frond),
      calledBy: report.edges.filter((edge) => edge.to === frond.frond),
    }));
}

/**
 * A frond this process called that publishes nothing of its own shape.
 *
 * The honest reading of `entities: 0, doors: 0` on a remote: its shape is published by the
 * process that owns it, under its own service name — so a panel pointed here can say the
 * frond is reachable and cannot say what it holds. Worth naming rather than drawing as an
 * empty frond, which reads as a frond with nothing in it.
 */
export function isOpaque(node: FrondPlacement): boolean {
  return node.placement === 'remote' && node.entities === 0 && node.doors === 0;
}
