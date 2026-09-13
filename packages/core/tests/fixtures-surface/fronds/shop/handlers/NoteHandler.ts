import { Crud } from '../../../../../src/prefab/CrudConstructor.js';
import Note from '../entities/Note.js';
export default class NoteHandler extends Crud(Note) {}
