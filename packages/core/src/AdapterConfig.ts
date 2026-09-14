/** Protocol adapters, by the name of the package that provides them. */
export interface AdapterConfig {
  /** `@fougere/adapter-rest` — REST under `/api/{frond}/{plural}`. */
  rest?: boolean;
  /** `@fougere/adapter-graphql` — a GraphQL schema over the same operations. */
  graphql?: boolean;
  /** A surface of your own; the framework only records that you declared it. */
  [adapter: string]: boolean | undefined;
}

// ── Loading ──────────────────────────────────────
