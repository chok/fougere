import { Crud } from '@fougere/core';
import Note from '../entities/Note.js';

/** The index card — no body. Derived from the entity, not hand-written. */
export class NoteCard extends Note.pick('id', 'title') {}

/**
 * A view named for ONE op. `findById` keeps the full row, so a validator reading
 * `body` still works — which is exactly what the handler-wide `Crud(E, Output)`
 * could not do, since it scopes the storage itself.
 */
export default class NoteHandler extends Crud(Note, { list: NoteCard }) {}
