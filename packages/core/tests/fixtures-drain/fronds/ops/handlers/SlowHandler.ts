/** A call that is still running when someone decides to let the app go. */
export default class SlowHandler {
  /** Take a while, then answer. */
  async work(): Promise<{ done: boolean }> {
    await new Promise((resolve) => setTimeout(resolve, 40));
    return { done: true };
  }

  /** Refuse. A call that throws must give its ticket back like any other. */
  async boom(): Promise<{ done: boolean }> {
    throw new Error('nope');
  }

  /** Never answer — what a drain with a deadline is for. */
  async hang(): Promise<{ done: boolean }> {
    await new Promise(() => {});
    return { done: true };
  }
}
