/**
 * One facade: where a call goes, and the handler that answers there.
 *
 * The address is carried as a LITERAL, which is what lets an operation be looked up by
 * `address.op`. A page never builds one by hand — the scan writes a `const` per address, and a
 * page imports it, so a project that never generated them fails to resolve rather than losing
 * its types in silence.
 */
export interface FacadeName<Handler, Address extends string> {
  readonly address: Address;
  /** Never read: it is how the handler's own signatures reach the page. */
  readonly handler?: Handler;
}
