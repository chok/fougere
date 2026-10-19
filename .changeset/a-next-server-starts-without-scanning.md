---
'@fougere/next': patch
'@fougere/vite': patch
'@fougere/defaults': patch
---

`next start` no longer scans: `withFougere` is a function of Next's phase and writes nothing when a
production server starts, and a production boot (`NODE_ENV=production`) reads the statement its build
wrote, whether the compiler is installed or not. `@fougere/next` and `@fougere/vite` take the compiler as
an optional peer. Measured on an installed app: no module of the compiler or of TypeScript loads.
