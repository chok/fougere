import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import ReportHandler from './fronds/ops/handlers/ReportHandler.js';
import RedactingLogger from './fronds/ops/services/RedactingLogger.js';

export default [frond('ops', {
  providers: [{ ctor: RedactingLogger, deps: ['Logger'] }],
  handlers: [{
    ctor: ReportHandler,
    deps: ['Logger'],
    operations: { run: op({ cardinality: 'one', description: 'Log a line carrying a secret.' }) },
  }],
})];
