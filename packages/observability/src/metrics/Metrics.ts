import type { Bucketed } from './Bucketed.js';
import { declaredTopologyOf, type App, type Edge, type FrondPlacement, type TopologyReport } from '@fougere/core';
import { activeCalls, type FinishedSpan, type SpanSink } from '../index.js';
import type { MetricsSnapshot } from './MetricsSnapshot.js';

const BOUNDS = [0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10];


export interface Metrics {
  /** Hand to `onSpan` — it reads the same span the tracer reads. */
  sink: SpanSink;
  /** What to publish now. */
  snapshot(): MetricsSnapshot;
}

/** `app` feeds the topology: which fronds this process found, and which run elsewhere. */
export function metrics(app?: App, bounds: readonly number[] = BOUNDS): Metrics {
  const since = Date.now();
  const series = new Map<string, Bucketed>();
  const seen = new Set<string>();
  const edges = new Map<string, Edge>();

  return {
    sink: (span: FinishedSpan) => {
      if (span.kind !== 'operation') return;

      const key = `${span.address}\0${span.operation}\0${span.error ?? ''}`;
      let row = series.get(key);
      if (!row) {
        row = {
          frond: span.frond,
          address: span.address,
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

function topologyOf(app: App | undefined, seen: Set<string>): FrondPlacement[] {
  const local = new Map((app?.fronds ?? [])
    .filter((frond) => !frond.fromExtension && !app?.remotes[frond.name])
    .map((frond) => [frond.name, frond] as const));

  const here: FrondPlacement[] = [...local.values()].map((frond) => ({
    frond: frond.name,
    placement: 'local' as const,
    entities: frond.entities.length,
    facades: frond.handlers.length,
  }));

  const elsewhere: FrondPlacement[] = [...seen]
    .filter((name) => !local.has(name))
    .map((name) => ({ frond: name, placement: 'remote' as const, entities: 0, facades: 0 }));

  return [...here, ...elsewhere];
}

function bucketOf(seconds: number, bounds: readonly number[]): number {
  for (let i = 0; i < bounds.length; i++) if (seconds <= bounds[i]!) return i;

  return bounds.length;
}

/** Serves the topology on `rpc.topology`. */
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
  const dimensions = (row: Bucketed) => [
    ...(row.frond ? [attr('fougere.frond', row.frond)] : []),
    attr('fougere.address', row.address),
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
