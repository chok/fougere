/** Seed factory — receives a resolver to access handlers cross-frond. */
export type SeedFactory = (resolve: <T>(name: string) => T) => Promise<Record<string, unknown>[]>;
