/**
 * CRAN 3 — la charge.
 *
 * `pnpm load:gen` réécrit `load.js`. Le régénérer plutôt que le rapiécer : tout ce qu'il
 * contient est lu de ce que l'app répond, sauf les poids, les paliers et les seuils.
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { testApp, loadScript } from '@fougere/testing';

const app = await testApp({ root: import.meta.dirname });
writeFileSync(join(import.meta.dirname, 'load.js'), loadScript(app, {
  door: 'http://127.0.0.1:4300/_fougere/call',
}));
await app.dispose();
console.log('✓ load.js');
