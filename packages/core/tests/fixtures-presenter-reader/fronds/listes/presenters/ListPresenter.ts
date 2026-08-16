import List from '../entities/List.js';
import User from '../entities/User.js';
import { Presenter } from '@fougere/core';

/** Computed fields that depend on WHO is asking — the whole point. */
export default class ListPresenter extends Presenter(List) {
  /** Counts its own calls, so a test can prove it ran once for the page. */
  static calls = 0;

  canEdit(lists: List[], user: User | null): boolean[] {
    ListPresenter.calls++;
    return lists.map((list) => Boolean(user) && list.ownerUserId === user!.id);
  }

  /**
   * SEVERAL values per row — two array levels, one for the page and one for the field.
   * Indistinguishable from `canEdit`'s single level until the parser counted them.
   */
  tags(lists: List[]): string[][] {
    return lists.map((list) => list.title.split(' '));
  }
}
