# admin-panel

Visual fixture for `@fougere/admin`: a small CMS built at runtime from an identity card,
with editorial statistics, recent content, user management, additive facets, dashboard
widget deltas, French messages, and the maintained Fougere theme.

```bash
pnpm --dir demos/admin-panel dev
```

The in-memory fetcher speaks the real Fougere JSON-RPC envelope and applies filters so
dashboard counts exercise the actual DataProvider path. It keeps the fixture self-contained;
provider and runtime tests cover the same mapping independently.
