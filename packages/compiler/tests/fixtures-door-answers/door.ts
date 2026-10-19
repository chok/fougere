import { DoorMiddleware } from '@fougere/core';

/** A door's answer, the way a door package would write it — the scan reads its fields, never its name. */
export interface Answer<Status extends number = number, Headers extends Record<string, string> = Record<never, string>> {
  status: Status;
  headers?: Headers;
  data: unknown;
}

/** What a door package hands out, bound to a handler. */
export function LineMiddleware(handler: abstract new (...args: never[]) => unknown) {
  abstract class AtLine extends DoorMiddleware<unknown, Answer> {
    static override readonly door = 'line';
    static override readonly handler = handler;

    around(): Promise<Answer> {
      throw new Error('not run in a scan');
    }
  }

  return AtLine;
}
