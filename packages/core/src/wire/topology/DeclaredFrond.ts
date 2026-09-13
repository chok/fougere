/** A frond the config knows of, and where it says to reach it. */
export interface DeclaredFrond {
  frond: string;
  placement: 'local' | 'remote';
  /**
   * Host and port of the address `remotes:` names, absent when the frond runs here. Never the
   * whole address: a declared one may carry credentials, and this answer leaves the process.
   */
  at?: string;
}
