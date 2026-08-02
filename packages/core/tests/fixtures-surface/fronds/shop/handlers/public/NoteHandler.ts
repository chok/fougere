import { Crud } from '../../../../../../src/crud.js';
import Note from '../../entities/Note.js';

/** What the public door emits — the secret stays home. */
export class NoteCard extends Note.pick('id', 'title') {}

export default class NoteHandler extends Crud(Note, NoteCard) {}
