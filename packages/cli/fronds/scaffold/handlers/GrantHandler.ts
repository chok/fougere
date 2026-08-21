/**
 * The work lives in app/commands/GrantCommand (it prints secrets). This handler
 * exists only so the runner registers the `grant` subcommand.
 */
export default class GrantHandler {
  /** Bind a frond's name to a fresh key, signed by the root. */
  async execute(): Promise<void> {}
}
