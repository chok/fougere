import { type Metrics } from '../metrics/Metrics.js';

export interface OtlpOptions {
  /** Which service these spans belong to — what a dashboard groups by. */
  service: string;
  /** Collector endpoint. Default: the OTLP/HTTP convention on localhost. */
  url?: string;
  /** How often a full batch leaves. Default: every second. */
  flushMs?: number;
  /** Told when a batch could not be sent. Default: silence — a trace must never break a call. */
  onError?: (err: unknown) => void;
  /** Publish these metrics on the same beat. */
  metrics?: Metrics;
  /** Where metrics go when it is not the same collector as traces. */
  metricsUrl?: string;
}
