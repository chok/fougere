import Note from '../entities/Note.js';

const PRESENTER_TARGET = Symbol.for('fougere:presenter_target');

/** One computed field, to prove where enrichment stops. */
export default class NotePresenter {
  static [PRESENTER_TARGET] = Note;

  excerpt(note: { body: string }): string {
    return note.body.slice(0, 3);
  }
}
