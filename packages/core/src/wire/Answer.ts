/** What one operation of a handler answers, unwrapped — the page's row type, never restated. */
export type Answer<Handler, Op extends keyof Handler> =
  Handler[Op] extends (...args: never[]) => infer Returned ? Awaited<Returned> : never;
