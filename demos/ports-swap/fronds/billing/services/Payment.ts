export interface Charge {
  provider: string;
  reference: string;
  amountCents: number;
}

/**
 * The port. It names no PSP, and nothing declares it a port — what makes it one is
 * that another scanned class extends it.
 */
export default abstract class Payment {
  abstract charge(amountCents: number): Charge;
}
