import { frond } from '../../src/index.js';
import Note from './fronds/shop/entities/Note.js';
import NoteHandler from './fronds/shop/handlers/NoteHandler.js';
import NotePresenter from './fronds/shop/presenters/NotePresenter.js';

export default [frond('shop', { entities: [Note], handlers: [NoteHandler], presenters: [NotePresenter] })];
