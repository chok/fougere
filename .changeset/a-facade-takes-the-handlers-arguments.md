---
'@fougere/core': minor
'@fougere/transport-http': minor
'@fougere/app': patch
---

**Breaking.** Code that calls another frond's facade passes the handler's own arguments and gets its typed answer back, with no cast: `await this.articles.onHand()`. Nothing is collected or presented for such a call, since the caller already holds the values. A signed call now also carries its arguments, so a call replayed with other arguments is refused. A page cannot send arguments: it goes through the collectors like any request.
