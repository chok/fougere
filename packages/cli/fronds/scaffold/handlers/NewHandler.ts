/**
 * The guided flow lives in app/commands/NewCommand (it prompts and composes).
 * This handler exists only so the runner registers the `new` subcommand.
 */
export default class NewHandler {
  async execute(): Promise<void> {}
}
