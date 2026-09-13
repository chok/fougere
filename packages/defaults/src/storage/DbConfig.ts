/** The `db` field of fougere.config.ts, read structurally. */
export type DbConfig =
  | false
  | 'sqlite'
  | { source?: string; dialect?: string; path?: string }
  | undefined;
