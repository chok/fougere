import { frond } from '../../src/index.js';
import { fact, op } from '../contract.js';
import AlphaHandler from './fronds/alpha/handlers/AlphaHandler.js';
import BetaHandler from './fronds/beta/handlers/BetaHandler.js';

export default [
  frond('alpha', {
    handlers: [{
      ctor: AlphaHandler,
      deps: ['Emit<Beta>'],
      operations: { onAlpha: op({ args: [fact('fact', 'alpha')], cardinality: 'none', description: 'React to alpha by announcing beta.' }) },
    }],
    operationsOverrides: { 'alpha.onAlpha': { kind: 'command' } },
  }),
  frond('beta', {
    handlers: [{
      ctor: BetaHandler,
      deps: ['Emit<Alpha>'],
      operations: { onBeta: op({ args: [fact('fact', 'beta')], cardinality: 'none', description: 'React to beta by announcing alpha.' }) },
    }],
    operationsOverrides: { 'beta.onBeta': { kind: 'command' } },
  }),
];
