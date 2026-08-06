/**
 * The host lives in app/commands/ServeCommand (it boots the frond alone and
 * exposes it over HTTP). This handler exists only so the runner registers the
 * `serve` subcommand.
 */
export default class ServeHandler {
  /** Host a frond in its own process, behind JSON-RPC. */
  async execute(): Promise<void> {}
}
