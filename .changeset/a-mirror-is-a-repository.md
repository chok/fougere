---
'@fougere/core': major
'@fougere/compiler': patch
---

`Mirror<BookCard>` is a `Repository<BookCard>` that fills itself: write `pull`, call `refresh(since)`, and
read the copy like any rows. `Mirror(BookCard)` called as a function is gone with `MirrorConstructor` and
`MirrorOf`, and so is the `Storage<T>` its constructor took — it is seated on its rows like any repository.
The scan reads the entity through a generic base in between, `Mirror<T> extends Repository<T>`.
