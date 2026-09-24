import { frond } from '../../src/index.js';
import Ledger from './fronds/shop/entities/Ledger.js';
import Note from './fronds/shop/entities/Note.js';
import LedgerHandler from './fronds/shop/handlers/LedgerHandler.js';
import NoteHandler from './fronds/shop/handlers/NoteHandler.js';
import PublicNoteHandler from './fronds/shop/handlers/public/NoteHandler.js';

export default [frond('shop', {
  entities: [Ledger, Note],
  handlers: [LedgerHandler, NoteHandler, { ctor: PublicNoteHandler, surface: 'public' }],
})];
