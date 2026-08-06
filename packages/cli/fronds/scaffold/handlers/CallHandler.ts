/**
 * The client end lives in app/commands/CallCommand (it boots the project app
 * and drives one operation). This handler exists only so the runner registers
 * the `call` subcommand.
 */
export default class CallHandler {
  /** Invoke one operation of a frond from the terminal. */
  async execute(): Promise<void> {}
}
