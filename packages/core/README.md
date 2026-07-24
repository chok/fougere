# @fougere/core
> Le cœur — scan, contrat d'appel, façades
Un appel de frond est une **valeur** : `(entity, op, invocation)`. `createLocalRunner`
l'exécute strictement en local, `createAppRunner` suit la topologie (façades locales,
doublures distantes). Les transports déplacent la valeur, ils ne la reforment jamais.

La façade juge l'entrée, projette la sortie, et n'expose que ce qu'un contrat déclare.

Surface sans Node, pour le navigateur : le sous-chemin `@fougere/core/contract`.

## Installation
```bash
pnpm add @fougere/core
```

---

Fait partie de [Fougere](https://github.com/chok/fougere) — un schéma unique,
un gradient du monolithe au distribué, le même code utilisateur.
Documentation de référence : le site (`site/content`, fr/en).
