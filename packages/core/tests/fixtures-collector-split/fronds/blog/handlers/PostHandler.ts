import type User from '../../identity/entities/User.js';

/**
 * The consuming frond. It wants the current user; the collector that produces
 * one lives in `identity`, so this frond's own collector set is empty.
 *
 * The two ops differ only in how the parameter is spelled. Nothing else.
 */
export default class PostHandler {
  /** The explicit spelling of absence, needed when a required parameter follows. */
  async whoExplicit(user: User | undefined): Promise<unknown> {
    return user;
  }

  /** The concise spelling of the same type. */
  async whoOptional(user?: User): Promise<unknown> {
    return user;
  }
}
