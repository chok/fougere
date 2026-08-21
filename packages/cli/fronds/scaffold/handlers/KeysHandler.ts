/**
 * The work lives in app/commands/KeysCommand (it writes the root key). This
 * handler exists only so the runner registers the `keys` subcommand.
 */
export default class KeysHandler {
  /** Create the root key a split deployment's grants are signed by. */
  async execute(): Promise<void> {}
}
