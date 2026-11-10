/** What `verifyEnvelope` establishes — never what the caller asked for. */
export interface VerifiedCall {
  /** The frond that signed, as the root named it. */
  caller: string;
  /** The state it asserted, now proven to come from `caller`. */
  state: Record<string, unknown>;
}
