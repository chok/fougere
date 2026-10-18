import { frond } from '@fougere/core';
import Note from './notes/Note.js';
import NoteHandler from './notes/NoteHandler.js';

export default [frond('notes', { entities: [Note], handlers: [NoteHandler] })];
