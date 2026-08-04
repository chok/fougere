/**
 * E2E test: local frond + remote frond sync
 *
 * 1. Boots the remote-blog server
 * 2. Syncs schemas via /_fougere/schema
 * 3. Verifies generated files provide the same API as local entities
 * 4. Validates data through both local and synced schemas
 */
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = import.meta.dirname;
const REMOTE_DIR = join(ROOT, 'remote-blog');
const CONSUMER_DIR = join(ROOT, 'consumer');
const SYNCED_DIR = join(CONSUMER_DIR, '.fougere', 'remotes');
const PORT = 4099; // Use non-standard port to avoid conflicts

let server: ChildProcess | null = null;

function log(msg: string) { console.log(`  ${msg}`); }
function pass(msg: string) { console.log(`  \x1b[32m✓\x1b[0m ${msg}`); }
function fail(msg: string) { console.error(`  \x1b[31m✗\x1b[0m ${msg}`); process.exit(1); }

async function waitForServer(url: string, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* not ready */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Server not ready after ${timeoutMs}ms`);
}

async function main() {
  console.log('\n=== Multi-frond E2E test ===\n');

  // Clean up synced files from previous runs
  if (existsSync(SYNCED_DIR)) {
    rmSync(SYNCED_DIR, { recursive: true });
  }

  // 1. Start remote-blog server
  log('Starting remote-blog server...');
  // `detached` puts the server in its own process group. `tsx` is a wrapper that
  // spawns node underneath, so killing the wrapper alone leaves a grandchild holding
  // the port and the pipes — and nothing ever returns. The group is what we started,
  // so the group is what we stop.
  server = spawn('npx', ['tsx', 'server.ts'], {
    cwd: REMOTE_DIR,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe',
    detached: true,
  });

  try {
    await waitForServer(`http://localhost:${PORT}/api/posts`);
    pass('Remote server started');

    // 2. Test discovery — rpc.discover on the envelope, the one surface
    log('Calling rpc.discover...');
    const res = await fetch(`http://localhost:${PORT}/_fougere/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'rpc.discover', params: { params: {}, query: {}, state: {} } }),
    });
    const card = (await res.json() as any).result;

    if (!card?.fronds?.length) fail('No fronds in identity card');
    const blogFrond = card.fronds.find((f: any) => f.name === 'blog');
    if (!blogFrond) fail('Blog frond not found in identity card');
    const post = blogFrond.entities.find((e: any) => e.name === 'post');
    const author = blogFrond.entities.find((e: any) => e.name === 'author');
    if (!post) fail('Post entity not in identity card');
    if (!author) fail('Author entity not in identity card');
    // Hosting means answering: the card carries the ops, not just the shape.
    if (!post.ops?.some((o: { name: string }) => o.name === 'list')) fail('Post ops missing from identity card');
    if (!post.schema?.properties) fail('Post schema missing from identity card');
    pass(`rpc.discover returns ${blogFrond.entities.length} entities with their ops`);

    // 3. Test REST API works
    log('Testing REST API...');
    const postsRes = await fetch(`http://localhost:${PORT}/api/posts`);
    const posts = await postsRes.json() as any[];
    if (!Array.isArray(posts) || posts.length < 2) fail('Expected seeded posts');
    pass(`REST API returns ${posts.length} seeded posts`);

    // 4. Sync remote schemas
    log('Syncing remote schemas...');
    execSync('npx tsx sync-remote.ts', {
      cwd: CONSUMER_DIR,
      env: { ...process.env, REMOTE_URL: `http://localhost:${PORT}` },
      stdio: 'pipe',
    });

    // Verify generated files
    const postFile = join(SYNCED_DIR, 'blog', 'entities', 'Post.ts');
    const authorFile = join(SYNCED_DIR, 'blog', 'entities', 'Author.ts');
    const pkgFile = join(SYNCED_DIR, 'blog', 'package.json');

    if (!existsSync(postFile)) fail('Post.ts not generated');
    if (!existsSync(authorFile)) fail('Author.ts not generated');
    if (!existsSync(pkgFile)) fail('package.json not generated');
    pass('Synced files generated');

    // 5. Verify generated package.json
    const pkg = JSON.parse(readFileSync(pkgFile, 'utf-8'));
    if (pkg.name !== '@frond/blog') fail(`Wrong package name: ${pkg.name}`);
    if (!pkg.exports?.['./entities/*']) fail('Missing exports field');
    pass('Generated package.json is correct');

    // 6. Verify generated code imports and works
    log('Testing generated schemas...');
    const postContent = readFileSync(postFile, 'utf-8');
    if (!postContent.includes('reconstruct')) fail('Missing reconstruct');
    pass('Generated code uses correct imports');

    // 7. Actually import and test the generated schema
    const { default: Post } = await import(postFile);

    // getFields
    const fields = Post.getFields();
    const fieldNames = Object.keys(fields).sort();
    const expected = ['body', 'createdAt', 'id', 'title', 'views'];
    if (JSON.stringify(fieldNames) !== JSON.stringify(expected)) {
      fail(`Wrong fields: ${fieldNames.join(', ')} (expected: ${expected.join(', ')})`);
    }
    pass('Post.getFields() returns correct fields');

    // validate
    const valid = Post.validate({ id: '1', title: 'Hello', body: 'World', views: 10 });
    if (!valid.success) fail('Valid data rejected');
    pass('Post.validate() accepts valid data');

    const invalid = Post.validate({ title: '', body: 'x', views: -1 });
    if (invalid.success) fail('Invalid data accepted');
    pass('Post.validate() rejects invalid data');

    // pick/omit
    const CreatePost = Post.omit('id', 'createdAt');
    const createFields = Object.keys(CreatePost.getFields()).sort();
    if (JSON.stringify(createFields) !== JSON.stringify(['body', 'title', 'views'])) {
      fail(`Wrong CreatePost fields: ${createFields.join(', ')}`);
    }
    pass('Post.omit() works');

    // Standard Schema v1
    const standard = Post['~standard'];
    if (standard.version !== 1 || standard.vendor !== 'fougere') {
      fail('Standard Schema v1 not correct');
    }
    pass('Post["~standard"] is Standard Schema v1');

    // 8. Test local frond import
    log('Testing local frond...');
    const { default: Product } = await import(
      join(CONSUMER_DIR, 'fronds', 'catalog', 'entities', 'Product.ts')
    );
    // Use omit('id') like a real form would — primary keys are auto-generated
    const CreateProduct = Product.omit('id');
    const productValid = CreateProduct.validate({ name: 'Widget', price: 9.99, stock: 5 });
    if (!productValid.success) fail('Local Product validation failed');
    pass('Local @frond/catalog works identically');

    // Verify Standard Schema v1 on local frond too
    const productStandard = CreateProduct['~standard'];
    if (productStandard.version !== 1) fail('Local Standard Schema v1 failed');
    pass('Local Product["~standard"] is Standard Schema v1');

    console.log('\n\x1b[32m  All tests passed!\x1b[0m\n');

  } finally {
    if (server) {
      stopServer(server);
      log('Remote server stopped');
    }
  }
}

/** Stop the whole process group — see the `detached` note at the spawn. */
function stopServer(child: ChildProcess): void {
  if (child.pid === undefined) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // Already gone, or never grouped — the direct kill is the fallback.
    child.kill();
  }
}

main().catch((err) => {
  console.error(err);
  if (server) stopServer(server);
  process.exit(1);
});
