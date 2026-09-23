export default {
  db: { dialect: 'sqlite', path: ':memory:' },
  // The address a CONSUMER reaches `notes` at — the host that serves it reads the same file.
  fronds: { notes: 'http://127.0.0.1:9' },
};
