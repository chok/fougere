export default abstract class Payment {
  abstract charge(amountCents: number): string;
}
