/**
 * What one operation says to each protocol that serves it — `rest: { path }`, `graphql: 'posts'`
 * — one key per protocol, written by the adapter that serves it, never here. How an operation is
 * CALLED belongs beside it, in `frond.config.ts`; where the protocol is mounted is the app's.
 *
 * Documented: [surfaces](https://fougere.dev/docs/infra/surfaces).
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface FougereOperationProtocols {}
