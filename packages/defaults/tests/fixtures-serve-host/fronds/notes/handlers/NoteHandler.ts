import { Crud } from '@fougere/core';
import Note from '../entities/Note.js';

export default class NoteHandler extends Crud(Note) {}
