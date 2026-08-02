import { Crud } from '../../../../../src/crud.js';
import Note from '../entities/Note.js';
export default class NoteHandler extends Crud(Note) {}
