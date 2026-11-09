/** One facade: its address, as a literal, and the handler that answers there. */
export interface FacadeName<Handler, Address extends string> {
  readonly address: Address;
  /** Never read: it is how the handler's own signatures reach the page. */
  readonly handler?: Handler;
}
