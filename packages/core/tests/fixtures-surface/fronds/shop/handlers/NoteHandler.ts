import { Crud } from '../../../../../src/prefab/crud.js';
import Note from '../entities/Note.js';
export default class NoteHandler extends Crud(Note) {}
