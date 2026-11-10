---
'@fougere/core': minor
'@fougere/calls': patch
'@fougere/observability': patch
---

`argumentText` writes an argument of a log line as text, and both the call panel and the OTLP log exporter read it — they wrote the same rule twice.
