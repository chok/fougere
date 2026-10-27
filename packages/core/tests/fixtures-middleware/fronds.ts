import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import DigestHandler from './fronds/mail/handlers/DigestHandler.js';
import Everywhere from './fronds/ops/services/Everywhere.js';
import Note from './fronds/shop/entities/Note.js';
import NoteHandler from './fronds/shop/handlers/NoteHandler.js';
import Audit from './fronds/shop/services/Audit.js';
import Trail from './fronds/shop/services/Trail.js';

export default [
  frond('mail', {
    handlers: [{
      ctor: DigestHandler,
      operations: {
        count: op({ cardinality: 'none', description: 'Reached to prove a frond-scoped middleware next facade does NOT run here.' }),
      },
    }],
  }),
  frond('ops', { providers: [{ ctor: Everywhere, deps: ['Dispatcher'], implements: ['Dispatcher'] }] }),
  frond('shop', {
    entities: [Note],
    providers: [Trail, { ctor: Audit, deps: ['Dispatcher', 'Trail'], implements: ['Dispatcher'] }],
    handlers: [{ ctor: NoteHandler, repository: Note }],
  }),
];
