import { Crud } from '../../../../../../src/prefab/CrudConstructor.js';
import Note from '../../entities/Note.js';

/** What the public facade emits — the secret stays home. */
export class NoteCard extends Note.pick('id', 'title') {}

export default class NoteHandler extends Crud(Note, NoteCard) {}
