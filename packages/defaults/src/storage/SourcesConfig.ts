/** A named source and the entities it holds — the `sources` field, read structurally. */
export type SourcesConfig = Record<string, { source?: string; dialect?: string; path?: string; entities: string[] }> | undefined;
