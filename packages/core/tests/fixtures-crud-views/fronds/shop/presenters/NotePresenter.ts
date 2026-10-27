import Note from '../entities/Note.js';
import { Present } from '@fougere/core';

/** One computed field, to prove where enrichment stops. */
export default class NotePresenter extends Present<Note> {
  excerpt(notes: { body: string }[]): string[] {
    return notes.map((note) => note.body.slice(0, 3));
  }
}
