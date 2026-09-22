/** The app as ONE source sees it. */
export interface SourceView {
  fronds: readonly { readonly name: string; readonly entities: readonly { readonly name: string }[] }[];
  elsewhere: readonly string[];
}
