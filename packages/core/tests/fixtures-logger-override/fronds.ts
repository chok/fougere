import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import ReportHandler from './fronds/ops/handlers/ReportHandler.js';
import AuditLogger from './fronds/ops/services/AuditLogger.js';

export default [frond('ops', {
  providers: [AuditLogger],
  handlers: [{
    ctor: ReportHandler,
    deps: ['Logger'],
    operations: { run: op({ cardinality: 'one', description: 'Log a line and say which logger took it.' }) },
  }],
})];
