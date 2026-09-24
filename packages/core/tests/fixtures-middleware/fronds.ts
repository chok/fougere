import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import DigestHandler from './fronds/mail/handlers/DigestHandler.js';
import Everywhere from './fronds/ops/middlewares/Everywhere.js';
import Note from './fronds/shop/entities/Note.js';
import NoteHandler from './fronds/shop/handlers/NoteHandler.js';
import Audit from './fronds/shop/middlewares/Audit.js';
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
  frond('ops', { middlewares: [Everywhere] }),
  frond('shop', {
    entities: [Note],
    providers: [Trail],
    middlewares: [{ ctor: Audit, deps: ['Trail'] }],
    handlers: [NoteHandler],
  }),
];
