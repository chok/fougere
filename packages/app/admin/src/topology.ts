/** How the system is arranged, as the app itself reports it. */
import dagre from '@dagrejs/dagre';
import {
  CALL_ENDPOINT,
  fetcher as browserFetcher,
  sendCall,
  type Fetcher,
} from '@fougere/app/client';
import {
  ErrorCode,
  type DeclaredEdge,
  type Edge,
  type FrondPlacement,
  type TopologyReport,
  Invocation,
} from '@fougere/core/contract';

export type { TopologyReport, FrondPlacement, Edge, DeclaredEdge };

/** The report, or `undefined` when the app serves no topology at all. */
export async function fetchTopology(
  endpoint = CALL_ENDPOINT,
  fetcher: Fetcher = browserFetcher,
): Promise<TopologyReport | undefined> {
  try {
    return await sendCall(
      fetcher,
      { entity: 'rpc', op: 'topology' },
      Invocation.empty,
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
  /** Fronds its code reaches, whether or not a call has ever gone down the link. */
  declaredCalls: DeclaredEdge[];
  /** Where the config says to reach it, when it says so. */
  at?: string;
  /**
   * Declared in `remotes:` and never heard from. A different absence from an opaque remote,
   * which answered and keeps its shape to itself: this one may simply be down.
   */
  silent: boolean;
}

/** The report read as a graph — what runs here first, then what answered, then what never did. */
export function nodesOf(report: TopologyReport): TopologyNode[] {
  const order = { local: 0, remote: 1 };
  const stated = new Map(report.declared.fronds.map((one) => [one.frond, one]));
  const answered = new Set(report.fronds.map((frond) => frond.frond));

  const around = (frond: string) => ({
    calls: report.edges.filter((edge) => edge.from === frond),
    calledBy: report.edges.filter((edge) => edge.to === frond),
    declaredCalls: report.declared.edges.filter((edge) => edge.from === frond),
  });

  const heard: TopologyNode[] = [...report.fronds]
    .sort((a, b) => order[a.placement] - order[b.placement] || a.frond.localeCompare(b.frond))
    .map((frond) => ({
      ...frond,
      ...around(frond.frond),
      ...(stated.get(frond.frond)?.at ? { at: stated.get(frond.frond)!.at } : {}),
      silent: false,
    }));

  // The whole reason the declared half travels: a frond that never answered is absent from
  // the observed one, so without this the node the operator most needs to see is the one
  // that disappears.
  const silent: TopologyNode[] = report.declared.fronds
    .filter((one) => one.placement === 'remote' && !answered.has(one.frond))
    .sort((a, b) => a.frond.localeCompare(b.frond))
    .map((one) => ({
      frond: one.frond,
      placement: 'remote' as const,
      entities: 0,
      doors: 0,
      ...around(one.frond),
      ...(one.at ? { at: one.at } : {}),
      silent: true,
    }));

  return [...heard, ...silent];
}

export interface Point {
  x: number;
  y: number;
}

/** A node placed on the drawing. `x`/`y` are its CENTRE, the convention the layout answers in. */
export interface PlacedNode {
  node: TopologyNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * One link between two nodes. `count` is absent on a link nothing has travelled: the config
 * declares it and no call has gone down it, which is drawn broken rather than not drawn.
 */
export interface PlacedEdge {
  from: string;
  to: string;
  path: string;
  /** Where this link's figure goes — clear of every node, or absent when the route is a point. */
  at?: Point;
  count?: number;
  errors: number;
  /** Where this link's volume sits among the others, `0` to `1`. Absent when nothing travelled. */
  weight?: number;
}

export interface Drawing {
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  width: number;
  height: number;
}

const NODE = { width: 176, height: 54 };

/**
 * Where each frond sits, and the line between two of them.
 *
 * The placement is `@dagrejs/dagre`'s — ranks by depth, order within a rank chosen to cross as
 * little as possible, and a polyline per edge that goes around the nodes between its ends. Two
 * hand-written columns could not do the second or the third: a chain of three fronds put two of
 * them in one column, and the curve between them had to bulge around whatever sat in the way.
 *
 * Rendering stays ours, which is why only the layout is bought: the drawing reads `error.main`
 * and the rest of the MUI palette off the theme, and a library that painted its own canvas
 * would have to be told the theme again on every switch. Kiali left Cytoscape for this in 2.0.0,
 * and every service map whose source can be read — Grafana, Jaeger, Linkerd — buys the same half.
 */
export function layoutOf(nodes: readonly TopologyNode[]): Drawing {
  const graph = new dagre.graphlib.Graph();
  // Left to right: the reader is the process being asked, and what it depends on goes outward.
  graph.setGraph({ rankdir: 'LR', nodesep: 26, ranksep: 92, marginx: 22, marginy: 22 });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) graph.setNode(node.frond, { ...NODE });

  const links = linksBetween(nodes);
  for (const link of links) {
    if (graph.hasNode(link.from) && graph.hasNode(link.to)) graph.setEdge(link.from, link.to);
  }

  dagre.layout(graph);

  const travelled = links.map((link) => link.count).filter((count): count is number => count !== undefined);
  const shape = graph.graph();

  const placed: PlacedNode[] = nodes
    .filter((node) => graph.hasNode(node.frond))
    .map((node) => {
      const { x, y, width, height } = graph.node(node.frond) as PlacedNode;

      return { node, x, y, width, height };
    });

  return {
    nodes: placed,
    edges: links.flatMap((link) => {
      const drawn = graph.hasNode(link.from) && graph.hasNode(link.to) ? graph.edge(link.from, link.to) : undefined;
      if (!drawn) return [];

      const points = drawn.points as Point[];
      const at = labelAt(points, placed, figureOf(link).length * 3.4 + 8);

      return [{
        ...link,
        path: through(points),
        ...(at ? { at } : {}),
        ...(link.count === undefined ? {} : { weight: weightOf(link.count, travelled) }),
      }];
    }),
    width: shape.width ?? 0,
    height: shape.height ?? 0,
  };
}

/** A count as an operator reads it at a glance — `2.1k`, never `2140`. */
export function short(count: number): string {
  if (count < 1000) return String(count);

  return `${(count / 1000).toFixed(count < 10_000 ? 1 : 0)}k`;
}

/** What a link says of itself, and the only figure the drawing carries. */
export function figureOf(link: Pick<PlacedEdge, 'count' | 'errors'>): string {
  if (link.count === undefined) return '—';

  return link.errors > 0 ? `${short(link.count)} · ${short(link.errors)} ✕` : short(link.count);
}

/**
 * Where a volume sits among the others, on a SQUARE ROOT scale. Linear makes every link but the
 * busiest a hairline; a log flattens them the other way, and flattening is wrong at this spread —
 * 40 to 2140 is under two orders of magnitude, and the busiest link deserves to look it.
 */
function weightOf(count: number, travelled: readonly number[]): number {
  const high = Math.max(...travelled);
  if (high <= 0) return 1;

  return Math.sqrt(count / high);
}

/** Every link, observed or merely declared, each named once. */
function linksBetween(nodes: readonly TopologyNode[]): Omit<PlacedEdge, 'path'>[] {
  const observed = nodes.flatMap((one) => one.calls);
  const travelled = new Set(observed.map((edge) => `${edge.from} ${edge.to}`));

  return [
    ...observed.map((edge) => ({ from: edge.from, to: edge.to, count: edge.count, errors: edge.errors })),
    ...nodes
      .flatMap((one) => one.declaredCalls)
      .filter((edge) => !travelled.has(`${edge.from} ${edge.to}`))
      .map((edge) => ({ from: edge.from, to: edge.to, errors: 0 })),
  ];
}

/**
 * A B-spline over the waypoints — what dagre-d3 and Grafana draw their edges with.
 *
 * It deliberately does NOT pass through them. A curve pinned to the points takes its character
 * from their COUNT, and a router hands back two for a short hop and five for one that goes around
 * something — so every edge came out with a bearing of its own and the drawing read as noise.
 *
 * The ends are TRIPLED rather than joined by a straight segment: a clamped spline reaches its
 * endpoint on its own tangent, where an anchor line meets the curve at whatever angle it happens
 * to, which is a visible corner exactly where the arrow is.
 */
function through(points: readonly Point[]): string {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return '';
  if (points.length === 1) return `M ${first.x} ${first.y}`;

  const held = [first, first, ...points, last, last];
  const steps = held.slice(2).map((point, nth) => {
    const back = held[nth]!;
    const near = held[nth + 1]!;

    return `C ${(2 * back.x + near.x) / 3} ${(2 * back.y + near.y) / 3},`
      + ` ${(back.x + 2 * near.x) / 3} ${(back.y + 2 * near.y) / 3},`
      + ` ${(back.x + 4 * near.x + point.x) / 6} ${(back.y + 4 * near.y + point.y) / 6}`;
  });

  return `M ${first.x} ${first.y} ${steps.join(' ')}`;
}

/** A point at a fraction of a route's length. */
function alongOf(points: readonly Point[], fraction: number): Point | undefined {
  if (fraction <= 0 || fraction >= 1) return undefined;
  const spans = points.slice(1).map((point, nth) => Math.hypot(point.x - points[nth]!.x, point.y - points[nth]!.y));
  const target = spans.reduce((sum, span) => sum + span, 0) * fraction;

  let walked = 0;
  for (let nth = 0; nth < spans.length; nth++) {
    if (walked + spans[nth]! >= target) {
      const into = spans[nth] === 0 ? 0 : (target - walked) / spans[nth]!;

      return {
        x: points[nth]!.x + (points[nth + 1]!.x - points[nth]!.x) * into,
        y: points[nth]!.y + (points[nth + 1]!.y - points[nth]!.y) * into,
      };
    }
    walked += spans[nth]!;
  }

  return points.at(-1);
}

/**
 * Where a link's figure sits: halfway ALONG the route, then moved along it until it sits inside no
 * node. The middle waypoint is not the middle of the line — a routed edge bunches its points near
 * the ends — and a figure drawn over a card cannot be read at all.
 */
function labelAt(points: readonly Point[], boxes: readonly PlacedNode[], half: number): Point | undefined {
  const inside = (point: Point) => boxes.some((box) =>
    Math.abs(point.x - box.x) < box.width / 2 + half && Math.abs(point.y - box.y) < box.height / 2 + 13);

  const middle = alongOf(points, 0.5);
  if (!middle || !inside(middle)) return middle;

  for (let step = 1; step <= 12; step++) {
    for (const side of [-1, 1]) {
      const moved = alongOf(points, 0.5 + side * step * 0.035);
      if (moved && !inside(moved)) return moved;
    }
  }

  return middle;
}

/**
 * A frond this process called that publishes nothing of its own shape. Read AFTER `silent`:
 * a frond that never answered has the same two zeroes and a different reason for them.
 */
export function isOpaque(node: FrondPlacement): boolean {
  return node.placement === 'remote' && node.entities === 0 && node.doors === 0;
}
