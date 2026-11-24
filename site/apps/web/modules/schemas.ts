import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { defineNuxtModule } from 'nuxt/kit';
import { Topology } from '@fougere/core/node';

/** `Topology.format` → `public/schema/topology.json`, the schema an editor completes `fougere.topology.yaml` from. */
export default defineNuxtModule({
  meta: { name: 'schemas' },
  async setup(_options, nuxt) {
    const out = join(nuxt.options.rootDir, 'public', 'schema');
    await mkdir(out, { recursive: true });
    const schema = { $schema: 'https://json-schema.org/draft/2020-12/schema', ...(Topology.format.schema as object) };
    await writeFile(join(out, 'topology.json'), `${JSON.stringify(schema, null, 2)}\n`);
  },
});
