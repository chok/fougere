export default abstract class Payment {
  abstract charge(amountCents: number): { provider: string; amountCents: number };
}
