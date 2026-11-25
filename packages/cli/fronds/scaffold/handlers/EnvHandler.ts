/** Registers the `env` subcommand; `app/commands/EnvCommand` does the work. */
export default class EnvHandler {
  /** Print what a process is told by whoever starts it — in dev `fougere up`, in production the deployment. */
  async execute(): Promise<void> {}
}
