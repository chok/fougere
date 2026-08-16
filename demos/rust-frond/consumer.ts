/**
 * Le consommateur TypeScript — il ne sait rien du frond telemetry.
 *
 * Aucun `class Sensor extends entity({...})` n'existe dans ce repo : la
 * déclaration vit dans `src/main.rs`. Ce fichier prouve trois choses :
 *
 *   1. le CONTRAT voyage      — les opérations s'appellent, la doublure ne distingue rien
 *   2. la CARTE voyage        — rpc.discover rend le schéma déclaré en Rust
 *   3. le COMPORTEMENT se rebâtit — reconstruct() rend un juge vivant côté TS
 *
 * Le troisième point est celui qui compte : le juge local refuse un payload
 * sur des règles qu'aucune ligne de TypeScript ne déclare.
 */
import { createHttpTransport } from '@fougere/transport-http/client';
import { reconstruct, inputFields, outputFields } from '@fougere/schema';
import {
  EMPTY_INVOCATION,
  FougereError,
  type FrondCall,
  type IdentityCard,
  type InvocationContext,
  type Transport,
} from '@fougere/core/contract';

const RUST_FROND = process.env.RUST_FROND_URL ?? 'http://localhost:4200';

/**
 * La doublure — copie fidèle de `createRemoteFacade` (packages/core/src/boot/remote.ts, `createRemoteFacade`).
 * Elle est reproduite ici parce qu'elle n'est pas exportée hors de bootstrap ;
 * c'est le même Proxy, à la lettre.
 */
function doublure(entity: string, transport: Transport): Record<string, (input?: Partial<InvocationContext>) => Promise<unknown>> {
  return new Proxy({} as Record<string, (input?: Partial<InvocationContext>) => Promise<unknown>>, {
    get(_target, prop) {
      if (typeof prop !== 'string' || prop === 'then') return undefined;
      return async (input: Partial<InvocationContext> = {}) => {
        const call: FrondCall = { entity, op: prop };
        return transport(call, { ...EMPTY_INVOCATION, ...input });
      };
    },
  });
}

const title = (step: string, text: string) => console.log(`\n\x1b[36m${step}\x1b[0m ${text}`);
const show = (value: unknown) => console.log(JSON.stringify(value, null, 2).split('\n').map((l) => `   ${l}`).join('\n'));

async function main(): Promise<void> {
  const transport = createHttpTransport(RUST_FROND);

  // ─── 1. Découverte ───────────────────────────────────────────────
  title('1.', 'Découverte — le TS ne sait rien, il demande');

  const card = (await transport({ entity: 'rpc', op: 'discover' }, EMPTY_INVOCATION)) as IdentityCard;
  for (const frond of card.fronds) {
    for (const door of frond.doors) {
      console.log(`   ${frond.name} › ${door.name} — ops: ${door.ops.map((o) => o.name).join(', ')}`);
    }
    // Ce frond n'annonce rien ; un qui le ferait publierait ici la forme de ses faits.
    for (const fact of frond.facts) {
      console.log(`   ${frond.name} ! ${fact.name} — un fait, aucune op`);
    }
  }

  // ─── 2. Le schéma déclaré en Rust ────────────────────────────────
  title('2.', 'Le schéma — déclaré dans src/main.rs, jamais en TypeScript');

  // Une porte peut ne rien stocker — la carte publie alors ses ops et pas de schéma.
  // Ce frond en déclare un, donc l'absence est une panne, pas un cas à contourner.
  const descriptor = card.fronds[0].doors[0].schema;
  if (!descriptor) throw new Error("le frond Rust n'a publié aucun schéma — la carte est incomplète");

  console.log(`   ${Object.keys(descriptor.properties).length} champs · requis à la création : ${descriptor.required?.join(', ')}`);
  show(descriptor.properties.recordedAt);

  // ─── 3. Reconstruction ───────────────────────────────────────────
  title('3.', 'reconstruct() — le comportement se rebâtit côté TS');

  const Sensor = reconstruct(descriptor);
  console.log(`   entrée (ce qu'un client peut fournir) : ${Object.keys(inputFields(Sensor.getFields())).join(', ')}`);
  console.log(`   sortie (ce qu'un client peut lire)    : ${Object.keys(outputFields(Sensor.getFields())).join(', ')}`);

  // ─── 4. Le juge local ────────────────────────────────────────────
  title('4.', 'Le juge local refuse AVANT tout réseau — règles venues de Rust');

  const bad = { label: 'x', celsius: 250, checksum: 'forgé', couleur: 'rouge' };
  const verdict = Sensor.validate(bad);
  console.log(`   payload : ${JSON.stringify(bad)}`);
  if (!verdict.success) for (const error of verdict.errors) console.log(`   ✗ ${error.path || '.'} — ${error.message}`);

  const good = { label: 'cuve-est', celsius: 3.7 };
  console.log(`   payload : ${JSON.stringify(good)}`);
  console.log(`   ${Sensor.validate(good).success ? '✓ accepté localement' : '✗ refusé'}`);

  // ─── 5. Les appels ───────────────────────────────────────────────
  title('5.', 'Les appels — la doublure ne distingue pas Rust d\'un frond local');

  const sensor = doublure('sensor', transport);

  const listed = (await sensor.list()) as Array<{ id: string; label: string }>;
  console.log(`   sensor.list()      → ${listed.length} relevés : ${listed.map((s) => s.label).join(', ')}`);

  const created = (await sensor.record({ body: good })) as { id: string; checksum: string; recordedAt: string };
  console.log(`   sensor.record()    → ${created.id}`);
  console.log(`                        checksum ${created.checksum} — calculé en Rust, illisible d'ici`);
  console.log(`                        recordedAt ${created.recordedAt} — lifecycle create:'now', réalisé là-bas`);

  const found = (await sensor.findById({ params: { id: created.id } })) as { label: string };
  console.log(`   sensor.findById()  → ${found.label}`);

  // ─── 6. L'erreur typée traverse ──────────────────────────────────
  title('6.', 'L\'erreur traverse le fil et redevient typée');

  for (const attempt of [
    { what: 'findById sur un id absent', run: () => sensor.findById({ params: { id: 'nexiste-pas' } }) },
    { what: 'record avec le payload refusé plus haut', run: () => sensor.record({ body: bad }) },
  ]) {
    try {
      await attempt.run();
    } catch (error) {
      if (!(error instanceof FougereError)) throw error;
      console.log(`   ${attempt.what}`);
      console.log(`   ✗ ${error.code} — ${error.message}`);
      if (error.details) console.log(`     ${JSON.stringify(error.details)}`);
    }
  }

  console.log('\n\x1b[32m✓\x1b[0m Un frond hors TypeScript, indistinguable derrière le contrat.\n');
}

main().catch((error: unknown) => {
  if (error instanceof FougereError) {
    console.error(`\n✗ ${error.code} — ${error.message}`);
    console.error(`  Le frond Rust tourne-t-il ? (cargo run, puis ${RUST_FROND})\n`);
    process.exit(1);
  }
  throw error;
});
