import { rmSync } from 'node:fs';
import { basename, resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');

if (basename(dist) !== 'dist') {
  throw new Error(`Refusing to clean unexpected path: ${dist}`);
}

rmSync(dist, { recursive: true, force: true });
