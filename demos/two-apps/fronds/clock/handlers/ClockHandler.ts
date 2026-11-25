/** The time, answered from a process of its own. */
export default class ClockHandler {
  now(): string {
    return new Date().toISOString();
  }
}
