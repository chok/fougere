export interface Charge { provider: string; amountCents: number }

/**
 * The port. It names no provider, which is the whole point — and it is `abstract`,
 * which the framework cannot see: TypeScript erases the keyword, so nothing at boot
 * distinguishes this from an ordinary service. What makes it a port is that another
 * scanned class extends it.
 */
export default abstract class Payment {
  abstract charge(amountCents: number): Charge;
}
