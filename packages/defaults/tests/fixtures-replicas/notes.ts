import { entity, primary, text } from '@fougere/schema';
import { Repository, frond } from '@fougere/core';

export class Note extends entity({ id: primary(), title: text() }) {}
class NoteHandler extends Repository<Note> {}

export const SEEDED = ['one', 'two', 'three', 'four', 'five'];

export const notes = frond('notes', {
  entities: [Note],
  handlers: [{ ctor: NoteHandler, repository: Note }],
  seeds: [{ entityName: 'note', data: SEEDED.map((title) => ({ title })) }],
});
