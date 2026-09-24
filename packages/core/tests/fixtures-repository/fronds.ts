import { frond } from '../../src/index.js';
import { op } from '../contract.js';
import Node from './fronds/mesures/entities/Node.js';
import Reading from './fronds/mesures/entities/Reading.js';
import NodeHandler from './fronds/mesures/handlers/NodeHandler.js';
import ReadingHandler from './fronds/mesures/handlers/ReadingHandler.js';
import ReadingRepository from './fronds/mesures/repositories/ReadingRepository.js';

export default [frond('mesures', {
  entities: [Node, Reading],
  providers: [{ ctor: ReadingRepository, deps: ['ReadingStorage'] }],
  handlers: [
    { ctor: NodeHandler, deps: ['NodeRepository'], operations: { all: op({ output: Node, cardinality: 'page' }) } },
    { ctor: ReadingHandler, deps: ['ReadingRepository'], operations: { loud: op({ output: Reading, cardinality: 'many' }) } },
  ],
  operationsOverrides: { loud: { kind: 'query' } },
})];
