import List from '../entities/List.js';
import User from '../entities/User.js';

const PRESENTER_TARGET = Symbol.for('fougere:presenter_target');

/** Computed fields that depend on WHO is asking — the whole point. */
export default class ListPresenter {
  static [PRESENTER_TARGET] = List;

  /** Counts its own calls, so a test can prove it ran once for the page. */
  static calls = 0;

  canEdit(lists: List[], user: User | null): boolean[] {
    ListPresenter.calls++;
    return lists.map((list) => Boolean(user) && list.ownerUserId === user!.id);
  }
}
