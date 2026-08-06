import { chmodSync } from 'node:fs';
import { resolve } from 'node:path';

const paths = process.argv.slice(2);

if (paths.length === 0) {
  throw new Error('Expected at least one path to mark as executable');
}

for (const path of paths) {
  chmodSync(resolve(process.cwd(), path), 0o755);
}
