/**
 * A base class exported by NAME, not as the file's default.
 *
 * Perfectly valid at runtime — `extends BaseReporting` works. But the heritage pass
 * looks for the file's DEFAULT class (`findDefaultClass`), finds none, and used to
 * give up in silence: `weekly` was simply absent from the façade, and nothing said
 * whether the base had no operation or could not be read.
 */
export class BaseReporting {
  /** Le rapport de la semaine. */
  async weekly(): Promise<{ count: number }> {
    return { count: 0 };
  }
}
