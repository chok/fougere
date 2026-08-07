# multi-transport — one frond, three protocols

```bash
pnpm -C demos/multi-transport dev
```

One frond in `fronds/sensors/`. Three receivers over the same runner: in memory,
over HTTP, over a raw TCP socket. The same call goes down all three and gives the
same value, the same validation verdict, the same typed failure.

```
  list()
    in-process       2 rows · north-ridge, harbour
    http     :64513  2 rows · north-ridge, harbour
    tcp      :64514  2 rows · north-ridge, harbour

  create({ celsius: 200 })
    in-process       VALIDATION_FAILED celsius: 200 is greater than 60.
    http     :64513  VALIDATION_FAILED celsius: 200 is greater than 60.
    tcp      :64514  VALIDATION_FAILED celsius: 200 is greater than 60.
```

## What to read

**`fronds/sensors/`** — a handler and an entity. Nothing in there names a port, a
protocol or a broker. That is what makes the rest possible, and it is the only
file a user of the framework writes.

**`socket-transport.ts`** — the transport, in application code. Not a package you
install: ~60 lines you own. It imports three things from fougere and none of them
are HTTP —

| | what it is |
|---|---|
| `frameCall` / `unframeResponse` | the JSON-RPC 2.0 written form of a call |
| `handleRpc` | the receiving half: object in, object out |

What a protocol has to supply is moving bytes, and saying what it means when they
do not arrive. **The second half is most of the file.** HTTP hands you one answer
per request and a fresh connection per call; a socket hands you neither, so `id`
pairs the answers and a dead connection has to strand the calls in flight itself.
That is the honest cost of a new transport — not the framing, the failures.

**`main.ts`, last block** — the topology statement:

```ts
remotes: { sensors: `tcp://127.0.0.1:${port}` },
remoteTransport: (url) =>
  url.startsWith('tcp://') ? createSocketTransport(...) : createHttpTransport(url),
```

`remoteTransport` receives the address, so the URL scheme picks the transport —
the same convention as `postgres://` or `amqp://`. A second frond reachable over
`http://` needs no extra configuration. **The transport belongs to the link, not
to the frond**: two consumers may reach the same frond differently, and the frond
does not get a say.

## What is not here

**Redis, MQTT, Kafka.** All three are the same shape as `socket-transport.ts`;
Redis is the shortest, because a per-call reply key does the pairing for you
(`LPUSH fougere:calls` / `BLPOP fougere:reply:<id>`). None is written yet.

**Fire-and-forget.** JSON-RPC's own notification — a request with no `id` — is
what "publish and do not wait" would be on the wire, and the receiver rejects it
as malformed today. Until an operation can declare that its result is not
awaited, a broker transport can only do request/response, which is paying for a
log to make a phone call.
