import ArchiveHandler from './handlers/ArchiveHandler.js';

export default {
  operations: {
    publish: {
      kind: 'command',
      handler: ArchiveHandler,
      method: 'execute',
    },
  },
};
