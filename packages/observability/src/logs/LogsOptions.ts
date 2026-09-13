export interface LogsOptions {
  /** Which service these lines belong to. */
  service: string;
  /** Collector endpoint. Default: the OTLP/HTTP convention on localhost. */
  url?: string;
  /** How often a batch leaves. Default: every second. */
  flushMs?: number;
  /** Told when a batch could not be sent. Default: silence. */
  onError?: (err: unknown) => void;
  /** Drop anything below this level before it leaves the process. */
  minimum?: 'debug' | 'info' | 'warn' | 'error';
}
