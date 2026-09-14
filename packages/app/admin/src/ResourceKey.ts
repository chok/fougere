/** What a resource must tell the provider — the rest of the card is the UI's business. */
export interface ResourceKey {
  /** The registration key its facade answers under — `post`, not `Post`. */
  name: string;
  /** The field that identifies an instance. */
  primary: string;
}
