import type User from '../../identity/entities/User.js';

/**
 * The consuming frond. It wants the current user; the collector that produces
 * one lives in `identity`, so this frond's own collector set is empty.
 *
 * The two ops differ only in how the parameter is spelled. Nothing else.
 */
export default class PostHandler {
  /** The spelling `CLAUDE.md` prescribes. */
  async whoNull(user: User | null): Promise<unknown> {
    return user;
  }

  /** The spelling that admits the failure. */
  async whoOptional(user?: User): Promise<unknown> {
    return user;
  }
}
