/**
 * What a derivation was cut from, and what the cut left — `nameOf` keyed by the
 * ORIGIN's field names. Absent on a declaration that derives from nothing.
 *
 * A dropped field is `null` and never `undefined`: JSON.stringify erases the second,
 * which would leave the card saying only what remains — what `properties` already says.
 */
export interface DerivedFrom {
  from: string;
  nameOf: Record<string, string | null>;
}
