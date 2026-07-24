# @fougere/transport-http
> Le contrat d'appel sur le fil
JSON-RPC 2.0, une route : `POST /_fougere/call`. `serve()` héberge un frond dans son
propre process, `createHttpTransport()` l'appelle depuis un autre.

Pas de RPC sans voyage : en in-process, un appel reste une exécution mémoire directe.

## Installation
```bash
pnpm add @fougere/transport-http
```

---

Fait partie de [Fougere](https://github.com/chok/fougere) — un schéma unique,
un gradient du monolithe au distribué, le même code utilisateur.
Documentation de référence : le site (`site/content`, fr/en).
