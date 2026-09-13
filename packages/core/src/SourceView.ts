/** The app as ONE source sees it. */
export interface SourceView {
  fronds: readonly { readonly name: string; readonly entities: readonly { readonly name: string }[] }[];
  /** The auth provider's own entities, when they ride with this source. */
  auth?: unknown;
  elsewhere: readonly string[];
}
