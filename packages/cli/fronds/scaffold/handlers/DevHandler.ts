/** Registers the `dev` subcommand; `app/commands/DevCommand` does the work. */
export default class DevHandler {
  /** Run the app, or a process of `processes:`, from its sources, booted again at every change. */
  async execute(): Promise<void> {}
}
