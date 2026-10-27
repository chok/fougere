/** A door's answer, the way a door package would write it — the scan reads its fields, never its name. */
export interface Answer<Status extends number = number, Headers extends Record<string, string> = Record<never, string>> {
  status: Status;
  headers?: Headers;
  data: unknown;
}

/** What a door package hands out: the port its links stand in front of, bound to a handler by its argument. */
export abstract class Line<H = never> {
  declare private readonly standsAt?: H;
  constructor(protected readonly inner?: Line<H>) {}
  answer(_request: unknown): Promise<Answer> {
    throw new Error('not run in a scan');
  }
}
