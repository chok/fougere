import { Ring } from './Ring.js';
import { dotted } from '@fougere/schema';
import { validationErrorsOf, type DispatchEvent, type LogRecord } from '@fougere/core';
import type { ErrorGroup } from './ErrorGroup.js';

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
      fields: (validationErrorsOf(error) ?? []).map((one) => ({ path: dotted(one.path), message: one.message })),
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
