/** The two name sets a cross-source batch is read against — see {@link referenceFor}. */
export interface HostedNames {
  /** Registration names in THIS batch. */
  here: ReadonlySet<string>;
  /** Registration names the app hosts in another source — see `SourceView.elsewhere`. */
  elsewhere: ReadonlySet<string>;
}
