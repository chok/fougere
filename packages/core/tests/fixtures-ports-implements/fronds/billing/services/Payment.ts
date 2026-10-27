export default abstract class Payment {
  abstract charge(amountCents: number): string;
  abstract refund(amountCents: number): string;
}
