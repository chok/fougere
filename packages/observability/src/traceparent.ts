/** `traceparent` — the one form a trace takes between two processes (W3C Trace Context). */

/** A step in a trace, as both halves of a split agree on it. */
export interface SpanContext {
  /** The whole call, across every process. 32 hex. */
  traceId: string;
  /** This step. 16 hex. */
  spanId: string;
  /** Whether the collector was asked to keep it. */
  sampled: boolean;
}

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const NO_TRACE = '0'.repeat(32);
const NO_SPAN = '0'.repeat(16);

/** The header a caller writes so the other side joins this trace. */
export function traceparentOf(span: SpanContext): string {
  return `00-${span.traceId}-${span.spanId}-${span.sampled ? '01' : '00'}`;
}

/** The header as a context, or nothing — a malformed one is ignored, never fatal. */
export function parseTraceparent(header: string | undefined): SpanContext | undefined {
  const found = typeof header === 'string' ? TRACEPARENT.exec(header.trim()) : null;
  if (!found) return undefined;

  const [, traceId, spanId, flags] = found;
  if (traceId === NO_TRACE || spanId === NO_SPAN) return undefined;
  return { traceId, spanId, sampled: (parseInt(flags, 16) & 1) === 1 };
}

const HEX = '0123456789abcdef';

/** A trace id (16) or a span id (8), as the spec sizes them. */
export function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  let out = '';
  for (const byte of buffer) out += HEX[byte >> 4] + HEX[byte & 15];
  return out;
}
