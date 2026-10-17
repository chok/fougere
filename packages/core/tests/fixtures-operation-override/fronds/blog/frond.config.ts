import ArchiveHandler from './handlers/ArchiveHandler.js';

export default {
  operations: {
    'post.publish': {
      kind: 'command',
      handler: ArchiveHandler,
      method: 'execute',
    },
  },
};
