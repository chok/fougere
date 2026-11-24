import '@fougere/adapter-sql';
export default {
  sources: { main: { type: 'sqlite', path: ':memory:' } },
  processes: { notes: { url: 'http://127.0.0.1:9', fronds: ['notes'] } },
};
