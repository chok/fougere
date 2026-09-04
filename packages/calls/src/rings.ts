import { validationErrorsOf, type DispatchEvent, type LogRecord } from '@fougere/core';

/** How many each ring keeps. Bounded by a NUMBER, never by a duration. */
const KEPT = 300;

/** One line this process wrote. `args` is the developer's own choice of what to record. */
export interface LogLine {
  seq: number;
  level: LogRecord['level'];
  name: string;
  message: string;
  /** Rendered here, not held: a live object would let the panel show what it later became. */
  args: string[];
  at: number;
}

/** One statement, as the panel shows it — never a parameter's value. */
export interface QueryLine {
  seq: number;
  storage: string;
  sql: string;
  parameters: number;
  ms: number;
  failed: boolean;
  at: number;
}

/** One kind of refusal, and how often it happened. */
export interface ErrorGroup {
  seq: number;
  key: string;
  code: string;
  entity?: string;
  operation?: string;
  message: string;
  count: number;
  firstAt: number;
  lastAt: number;
  /** Which field was refused, for a VALIDATION_FAILED — the whole point of this source. */
  fields: { path: string; message: string }[];
  /** `dispatch` when a call carried it, `log` when it happened outside any call. */
  from: 'dispatch' | 'log';
}

/** A bounded list that counts what it drops, so a busy moment never reads as a quiet one. */
class Ring<T extends { seq: number }> {
  protected readonly held: T[] = [];
  protected seq = 0;
  private lost = 0;

  constructor(private readonly max = KEPT) {}

  protected keep(make: (seq: number) => T): T {
    const record = make(++this.seq);
    this.held.push(record);
    if (this.held.length > this.max) this.lost += this.held.splice(0, this.held.length - this.max).length;

    return record;
  }

  since(cursor: number): { lines: T[]; cursor: number; dropped: number } {
    return { lines: this.held.filter((one) => one.seq > cursor), cursor: this.seq, dropped: this.lost };
  }
}

/** What this process logged. */
export class LogRing extends Ring<LogLine> {
  record(line: LogRecord): void {
    this.keep((seq) => ({
      seq,
      level: line.level,
      name: line.name,
      message: line.message,
      args: line.args.map(render),
      at: line.at,
    }));
  }
}

export class QueryRing extends Ring<QueryLine> {
  record(event: Omit<QueryLine, 'seq'>): void {
    this.keep((seq) => ({ ...event, seq }));
  }
}

/** What was refused, from TWO sources — and that is the point. */
export class ErrorRing extends Ring<ErrorGroup> {
  private readonly byKey = new Map<string, ErrorGroup>();

  /** A refusal that a call carried. `details` reaches here intact, unlike a span's code. */
  fromDispatch(event: DispatchEvent): void {
    const error = event.error as { code?: string; message?: string; details?: unknown } | undefined;
    const { entity, operation } = event.call.address;

    this.group({
      code: typeof error?.code === 'string' ? error.code : 'INTERNAL_ERROR',
      entity,
      operation,
      message: error?.message ?? String(event.error),
      fields: (validationErrorsOf(error) ?? []).map((one) => ({ path: one.path, message: one.message })),
      from: 'dispatch',
    });
  }

  /** A line written at `error` level, which is how a failure outside any call speaks. */
  fromLog(line: LogRecord): void {
    if (line.level !== 'error') return;

    this.group({ code: line.name, message: line.message, fields: [], from: 'log' });
  }

  private group(one: Omit<ErrorGroup, 'seq' | 'key' | 'count' | 'firstAt' | 'lastAt'>): void {
    const key = [one.from, one.code, one.entity ?? '', one.operation ?? ''].join(' ');
    const seen = this.byKey.get(key);
    const at = Date.now();

    // Grouped, because a refusal seen forty times is one line with a count — not forty
    // lines that push everything else out of a bounded ring.
    if (seen) {
      seen.count += 1;
      seen.lastAt = at;
      seen.message = one.message;
      if (one.fields.length > 0) seen.fields = one.fields;
      // Re-numbered so a reader that already saw this group is handed the higher count.
      // Without it a refusal seen forty times reports one, forever: the group is mutated
      // in place, and a cursor asks only for what is above it.
      seen.seq = ++this.seq;
      return;
    }

    this.byKey.set(key, this.keep((seq) => ({ ...one, key, seq, count: 1, firstAt: at, lastAt: at })));
  }
}

/** An argument as one line. A live object would change under the reader; a string cannot. */
function render(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
