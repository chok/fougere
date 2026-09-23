/** How much a caller may send — held ONCE for the process and CONSULTED at every door, like the log level. */
let limit = 2 * 1024 * 1024;

/** The room a hop keeps for what it adds around a call — trace, identity, state — which never counts against the caller. */
export const ENVELOPE_BYTES = 64 * 1024;

export function maxBodyBytes(): number {
  return limit;
}

/** Set by `applyConfig` from `maxBodyBytes:`. */
export function setMaxBodyBytes(bytes: number): void {
  if (!Number.isInteger(bytes) || bytes <= 0) {
    throw new Error(`maxBodyBytes: a positive whole number of bytes — got ${String(bytes)}.`);
  }
  limit = bytes;
}

/**
 * What a process forwarding a call may frame and a receiver may read: the caller's limit, and the
 * envelope's room. Measured against the caller's limit alone, a body just under it passed in
 * process and was refused a hop away.
 *
 * Documented: [gradient](https://fougere.dev/docs/infra/gradient).
 */
export function maxFrameBytes(): number {
  return limit + ENVELOPE_BYTES;
}
