import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import Entry from './fronds/journal/entities/Entry.js';
import EntryHandler from './fronds/journal/handlers/EntryHandler.js';
import ReaderHandler from './fronds/reader/handlers/ReaderHandler.js';

export const journal = frond('journal', {
  entities: [Entry],
  handlers: [{ ctor: EntryHandler, operations: { findLast: op({ output: Entry, cardinality: 'one', description: 'The last entry written.' }) } }],
});

export const reader = frond('reader', {
  handlers: [{
    ctor: ReaderHandler,
    deps: ['entryHandler'],
    operations: { findStamp: op({ cardinality: 'one', description: 'Is the stamp a `Date` on this side too?' }) },
  }],
});

export default [journal, reader];
