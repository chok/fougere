/**
 * The host lives in app/commands/DevCommand. This handler exists only so the runner registers
 * the `dev` subcommand.
 */
export default class DevHandler {
  /** Host a frond in its own process from its sources, booted again at every change. */
  async execute(): Promise<void> {}
}
