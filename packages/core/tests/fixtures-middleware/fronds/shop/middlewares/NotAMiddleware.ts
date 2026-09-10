/** No `around` — the directory holds it, the scan does not take it. */
export default class NotAMiddleware {
  handle(): void {}
}
