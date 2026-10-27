import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import ReportHandler from './fronds/ops/handlers/ReportHandler.js';
import RedactingLogger from './fronds/ops/services/RedactingLogger.js';
import MaskingLogger from './fronds/ops/services/MaskingLogger.js';

const handlers = [{
  ctor: ReportHandler,
  deps: ['Logger'],
  operations: { run: op({ cardinality: 'one', description: 'Log a line carrying a secret.' }) },
}];

export default [frond('ops', { providers: [{ ctor: RedactingLogger, deps: ['Logger'] }], handlers })];

/** The same wrapper as a link that implements the logger: what it does not write is the real one's. */
export const masked = [frond('ops', { providers: [{ ctor: MaskingLogger, deps: ['Logger'], implements: ['Logger'] }], handlers })];
