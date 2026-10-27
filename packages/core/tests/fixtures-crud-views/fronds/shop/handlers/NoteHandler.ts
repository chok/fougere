import { Page, Repository } from '@fougere/core';
import Note from '../entities/Note.js';

/** The index card — no body. Derived from the entity, not hand-written. */
export class NoteCard extends Note.pick('id', 'title') {}

/**
 * A view is a question of its own: `cards` answers the index card, and the five the repository
 * brings keep the full row — so a validator reading `body` still works, which a handler extending
 * the view itself (`Repository<NoteCard>`) could not do, since it reads through the view.
 */
export default class NoteHandler extends Repository<Note> {
  async cards(): Promise<Page<NoteCard>> {
    return Page.of(await this.list());
  }
}
