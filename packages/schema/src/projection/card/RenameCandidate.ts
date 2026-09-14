/** A removal and an addition that could be one rename: same shape, different name. */
export interface RenameCandidate {
  removed: string;
  added: string;
}
