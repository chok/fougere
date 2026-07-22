/**
 * The client end lives in app/commands/CallCommand (it boots the project app
 * and drives one operation). This handler exists only so the runner registers
 * the `call` subcommand.
 */
export default class CallHandler {
  async execute(): Promise<void> {}
}
