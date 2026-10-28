---
'@fougere/core': minor
'@fougere/compiler': minor
---

Every container key with a subject is spelled as the type is written: `Repository<Post>`, `Storage<Post>`, `Facade<PostHandler>`, `Emit<PostPublished>`, `Emit<CanBook, Verdict>`, `Together<[Account, Ledger]>`, `Collect<User>`, `Present<Post>`. They used to be `PostRepository`, `PostStorage`, `postHandler`, `postPublishedEmit`, `canBookAwait`, `Account+LedgerTogether`, `UserCollector` and `PostPresenter`. A `fronds.ts` written by hand renames its `deps:` the same way. A class named `PostStorage` can no longer take a storage's key, so the `storage-key-is-provider` refusal is gone. A listener in a refusal is named by its address, `index.reindex`.
