/** What a host hands the door a page calls through. */
export interface PageDoorOptions {
  /** What the host resolved of the caller, server-side. */
  state: Record<string, unknown>;
  /** The page's own HTTP request — what a cookie-kept state arrives and leaves in, written back by the host. */
  carrier?: unknown;
  /** Whether an announcement calls this op — one a page may not name. */
  listens?: (address: string, op: string) => boolean | Promise<boolean>;
}
