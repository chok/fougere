/** What a derivation was cut from, and what each field of the origin became; a dropped one is `null`. */
export interface DerivedFrom {
  from: string;
  nameOf: Record<string, string | null>;
}
