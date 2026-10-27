import { frond } from '../../src/index.js';
import Note from './fronds/shop/entities/Note.js';
import NoteHandler, { NoteCard } from './fronds/shop/handlers/NoteHandler.js';
import { op } from '../contract.js';
import NotePresenter from './fronds/shop/presenters/NotePresenter.js';

export default [frond('shop', { entities: [Note], handlers: [{ ctor: NoteHandler, repository: Note, operations: { cards: op({ output: NoteCard, cardinality: 'page' }) } }], presenters: [{ ctor: NotePresenter, presents: Note }] })];
