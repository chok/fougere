export interface FacadeOptions {
  /** Where the generated file will sit. Handler imports are written relative to it. */
  outFile: string;
  /** Where `fronds:` places each frond: an op that answers there, or calls there, can come back unanswered. */
  remotes?: Record<string, string>;
}
