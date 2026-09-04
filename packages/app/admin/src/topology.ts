/** How the system is arranged, as the app itself reports it. */
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

/** The report, or `undefined` when the app serves no topology at all. */
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

/** The report read as a graph, local fronds first. */
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

/** A frond this process called that publishes nothing of its own shape. */
export function isOpaque(node: FrondPlacement): boolean {
  return node.placement === 'remote' && node.entities === 0 && node.doors === 0;
}
