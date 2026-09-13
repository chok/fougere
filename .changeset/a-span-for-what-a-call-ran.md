---
'@fougere/observability': minor
'@fougere/adapter-sql': minor
'@fougere/testing': minor
---

A span for what a call ran, not only for the call.

An operation's duration says how long it took, never where it went. `selfMs` separates what the
op did from what it waited for, and a statement is a span of its own — so an N+1 is a number a
test can refuse rather than a shape someone has to notice.

`@fougere/testing` answers it two ways: `statementsOf` for what a call asked the database,
`spansOf` for the shape of the call itself. The first refuses when `@fougere/adapter-sql` is
absent, where the tracer degrades quietly — zero is what a passing assertion looks like, so an
app observing nothing would turn that into a test that cannot fail.

`trace(takers)` is now `tracing(takers)`, and it answers a pair rather than a middleware: a
statement is not dispatched, so nothing calls a middleware around a query, and both doors need
the same table. **This is a rename, and the old name is gone.**
