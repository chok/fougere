/** Extends nothing scanned, so it is no port and no implementation — the control. */
export default class Mailer {
  send(to: string) { return to; }
}
