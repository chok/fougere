export interface GenerateRoutesOptions {
  /** Keep only the addresses this answers true for. */
  filter?: (address: string, frondName: string) => boolean;
  /** Surface name for filtering (e.g. 'rest', 'graphql'). Uses frond.config.ts surfaces if set. */
  surface?: string;
}
