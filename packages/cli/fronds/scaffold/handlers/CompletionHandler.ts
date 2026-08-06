/**
 * The completion script is produced by CompletionCommand (it holds the app and
 * prints it). This handler exists only so the runner registers the subcommand.
 */
export default class CompletionHandler {
  /** Print the shell completion script for this CLI. */
  async execute(): Promise<void> {}
}
