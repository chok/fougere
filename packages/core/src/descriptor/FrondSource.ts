/** Where a frond lives on disk. */
export interface FrondSource {
  /** Absolute path to the frond directory. */
  path: string;
  /** The @fronds/{name} package name. Always present. */
  package: string;
}
