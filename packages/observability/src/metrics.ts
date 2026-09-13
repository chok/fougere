/** The four signals every service is judged on, derived from the span that already exists. */
import { declaredTopologyOf, type App, type Edge, type FrondPlacement, type TopologyReport } from '@fougere/core';

export type { Edge, FrondPlacement, TopologyReport } from '@fougere/core';
import { activeCalls, type FinishedSpan, type SpanSink } from './index.js';

/**
 * Bucket bounds in SECONDS, and the operator's to choose — this is the default, not the rule.
 *
 * The OpenTelemetry recommendation for request durations: dense under 100 ms because that is
 * where a healthy op lives, and open above 10 s. A system whose ops all cross two processes has
 * its floor elsewhere and wastes half these buckets.
 *
 * Deliberately NOT derived per operation, though `reach` could: an explicit-bucket histogram only
 * aggregates across series that share its bounds, so a panel asking for the p95 of the whole
 * service — which sums over every op — would stop meaning anything, silently. One list per
 * process is what keeps that reading honest. The number that IS per-op is the load threshold,
 * where nothing aggregates.
 */
const BOUNDS = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10];

interface Bucketed {
  frond: string | undefined;
  entity: string;
  operation: string;
  error: string | undefined;
  count: number;
  sum: number;
  /** One more than the bounds: the last holds everything above the highest bound. */
  buckets: number[];
  /** The same measurement over `selfMs` — what the op did rather than what it waited for. */
  selfSum: number;
  selfBuckets: number[];
  /** Every statement these calls ran. Against `count`, it is statements per call. */
  statements: number;
}

export interface Metrics {
  /** Hand to `onSpan` — it reads the same span the tracer reads. */
  sink: SpanSink;
  /** What to publish now. */
  snapshot(): MetricsSnapshot;
}


export interface MetricsSnapshot {
  /** When this process started counting — cumulative metrics are read against it. */
  since: number;
  series: Bucketed[];
  active: number;
  bounds: number[];
  /** The shape of the system as this process discovered it — declared nowhere. */
  topology: FrondPlacement[];
  /** Who calls whom, as observed here. Bounded by fronds², so it is a safe dimension. */
  edges: Edge[];
}

/**
 * `app` is optional and only feeds the topology: what fronds this process found, and which of them
 * run elsewhere.
 */
export function metrics(app?: App, bounds: readonly number[] = BOUNDS): Metrics {
  const since = Date.now();
  const series = new Map<string, Bucketed>();
  /** Every frond this process has actually CALLED — the other half of the topology. */
  const seen = new Set<string>();
  /** The call graph, as this process witnessed it. */
  const edges = new Map<string, Edge>();

  return {
    sink: (span: FinishedSpan) => {
      // The one reader that has to choose: a statement is a step, not a call this process
      // answered. Counted here it would publish `select.post` as an operation nothing
      // serves, and every topology and saturation figure would count it too.
      if (span.kind !== 'operation') return;

      const key = `${span.entity}\0${span.operation}\0${span.error ?? ''}`;
      let row = series.get(key);
      if (!row) {
        row = {
          frond: span.frond,
          entity: span.entity,
          operation: span.operation,
          error: span.error,
          count: 0,
          sum: 0,
          buckets: new Array(bounds.length + 1).fill(0),
          selfSum: 0,
          selfBuckets: new Array(bounds.length + 1).fill(0),
          statements: 0,
        };
        series.set(key, row);
      }
      if (span.frond) seen.add(span.frond);
      if (span.callerFrond && span.frond) {
        const key = `${span.callerFrond}\u0000${span.frond}`;
        const edge = edges.get(key) ?? { from: span.callerFrond, to: span.frond, count: 0, errors: 0 };
        edge.count += 1;
        if (span.error) edge.errors += 1;
        edges.set(key, edge);
      }
      const seconds = span.ms / 1000;
      row.count += 1;
      row.sum += seconds;
      row.buckets[bucketOf(seconds, bounds)] += 1;

      const self = span.selfMs / 1000;
      row.selfSum += self;
      row.selfBuckets[bucketOf(self, bounds)] += 1;
      row.statements += span.statements;
    },
    snapshot: () => ({
      since,
      series: [...series.values()],
      active: activeCalls(),
      bounds: [...bounds],
      topology: topologyOf(app, seen),
      edges: [...edges.values()],
    }),
  };
}

/**
 * The system's shape, from the two things this process can honestly say: what it SCANNED runs
 * here, and what it CALLED without having scanned it runs somewhere else.
 */
function topologyOf(app: App | undefined, seen: Set<string>): FrondPlacement[] {
  // What the app SERVES: a frond an extension brought is instrumentation, and reporting it
  // would describe this package to itself.
  //
  // A frond named in `remotes:` is scanned when its code sits in the same project, and stays
  // in `app.fronds` — the boot says `declared remote — not hosted locally` and keeps it. This
  // half reports what RUNS here, so it is not one of them: it used to answer `local` for a
  // frond every call reached over HTTP. Not a config-derived node either — it is named below
  // only once it has answered, like any other remote.
  const local = new Map((app?.fronds ?? [])
    .filter((frond) => !frond.brought && !app?.remotes[frond.name])
    .map((frond) => [frond.name, frond] as const));

  const here: FrondPlacement[] = [...local.values()].map((frond) => ({
    frond: frond.name,
    placement: 'local' as const,
    entities: frond.entities.length,
    facades: frond.handlers.length,
  }));

  // A frond we called but never scanned is hosted elsewhere. Its shape is not ours to
  // report — it is published by the process that owns it, under its own service name.
  const elsewhere: FrondPlacement[] = [...seen]
    .filter((name) => !local.has(name))
    .map((name) => ({ frond: name, placement: 'remote' as const, entities: 0, facades: 0 }));

  return [...here, ...elsewhere];
}

/** The first bound this duration does not exceed, or the overflow bucket. */
function bucketOf(seconds: number, bounds: readonly number[]): number {
  for (let i = 0; i < bounds.length; i++) if (seconds <= bounds[i]!) return i;

  return bounds.length;
}

/**
 * Serve the topology on `rpc.topology` — read from inside the process it describes.
 *
 * The declared half is read at every call rather than once here: `reloadFougere()` builds the app
 * again, and a config read at boot would keep answering for the app that was released.
 */
export function serveTopology(app: App, measured: Metrics): void {
  app.serveRpc('topology', (): TopologyReport => {
    const { since, active, topology, edges } = measured.snapshot();

    return { since, active, fronds: topology, edges, declared: declaredTopologyOf(app) };
  });
}

/** One snapshot, as OTLP/JSON spells metrics. Cumulative, which is what Prometheus reads. */
export function metricsPayload(service: string, snapshot: MetricsSnapshot) {
  const since = `${snapshot.since * 1e6}`;
  const now = `${Date.now() * 1e6}`;
  const attr = (key: string, value: string) => ({ key, value: { stringValue: value } });
  /** What an operation's three series are all sliced by — said once, so they stay comparable. */
  const dimensions = (row: Bucketed) => [
    ...(row.frond ? [attr('fougere.frond', row.frond)] : []),
    attr('fougere.entity', row.entity),
    attr('fougere.operation', row.operation),
    attr('fougere.outcome', row.error ? 'error' : 'ok'),
    ...(row.error ? [attr('fougere.error.code', row.error)] : []),
  ];

  return {
    resourceMetrics: [
      {
        resource: { attributes: [attr('service.name', service)] },
        scopeMetrics: [
          {
            scope: { name: '@fougere/observability' },
            /** Only what has points. */
            metrics: ([
              {
                name: 'fougere.operation.duration',
                description: 'How long an operation took, by op and by verdict.',
                unit: 's',
                histogram: {
                  // 2 = cumulative: counted from `since` and never reset, which is the
                  // only temporality Prometheus reads without a collector in between.
                  aggregationTemporality: 2,
                  dataPoints: snapshot.series.map((row) => ({
                    attributes: dimensions(row),
                    startTimeUnixNano: since,
                    timeUnixNano: now,
                    count: `${row.count}`,
                    sum: row.sum,
                    bucketCounts: row.buckets.map((n) => `${n}`),
                    explicitBounds: snapshot.bounds,
                  })),
                },
              },
              {
                name: 'fougere.operation.self',
                description: 'How long an operation took on its own, with what it waited for taken out.',
                unit: 's',
                histogram: {
                  aggregationTemporality: 2,
                  dataPoints: snapshot.series.map((row) => ({
                    attributes: dimensions(row),
                    startTimeUnixNano: since,
                    timeUnixNano: now,
                    count: `${row.count}`,
                    sum: row.selfSum,
                    bucketCounts: row.selfBuckets.map((n) => `${n}`),
                    explicitBounds: snapshot.bounds,
                  })),
                },
              },
              {
                name: 'fougere.operation.statements',
                description: 'Statements run under an operation. Against its count, statements per call.',
                unit: '{statement}',
                sum: {
                  aggregationTemporality: 2,
                  isMonotonic: true,
                  dataPoints: snapshot.series
                    .filter((row) => row.statements > 0)
                    .map((row) => ({
                      attributes: dimensions(row),
                      startTimeUnixNano: since,
                      timeUnixNano: now,
                      asInt: `${row.statements}`,
                    })),
                },
              },
              {
                name: 'fougere.operations.active',
                description: 'Operations running right now — the saturation signal.',
                unit: '{call}',
                gauge: { dataPoints: [{ asInt: `${snapshot.active}`, timeUnixNano: now }] },
              },
              {
                name: 'fougere.fronds',
                description: 'Fronds this process discovered, and whether they run here.',
                unit: '{frond}',
                gauge: {
                  dataPoints: snapshot.topology.map((f) => ({
                    attributes: [
                      attr('fougere.frond', f.frond),
                      attr('fougere.placement', f.placement),
                    ],
                    asInt: '1',
                    timeUnixNano: now,
                  })),
                },
              },
              {
                name: 'fougere.calls',
                description: 'One frond calling another — the edges of the service graph.',
                unit: '{call}',
                sum: {
                  aggregationTemporality: 2,
                  isMonotonic: true,
                  dataPoints: snapshot.edges.map((e) => ({
                    attributes: [attr('fougere.from', e.from), attr('fougere.to', e.to)],
                    startTimeUnixNano: since,
                    timeUnixNano: now,
                    asInt: `${e.count}`,
                  })),
                },
              },
              {
                name: 'fougere.calls.failed',
                description: 'Edges that came back refused.',
                unit: '{call}',
                sum: {
                  aggregationTemporality: 2,
                  isMonotonic: true,
                  dataPoints: snapshot.edges.map((e) => ({
                    attributes: [attr('fougere.from', e.from), attr('fougere.to', e.to)],
                    startTimeUnixNano: since,
                    timeUnixNano: now,
                    asInt: `${e.errors}`,
                  })),
                },
              },
              {
                name: 'fougere.frond.facades',
                description: 'How many facades a frond serves — its surface, as scanned.',
                unit: '{facade}',
                gauge: {
                  dataPoints: snapshot.topology.map((f) => ({
                    attributes: [attr('fougere.frond', f.frond)],
                    asInt: `${f.facades}`,
                    timeUnixNano: now,
                  })),
                },
              },
            ] as Record<string, any>[]).filter(
              (m) => (m.histogram ?? m.gauge ?? m.sum).dataPoints.length > 0,
            ),
          },
        ],
      },
    ],
  };
}
