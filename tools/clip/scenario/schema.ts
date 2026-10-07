import { pause, take } from '../take.ts';

const clip = await take();

await clip.run('pnpm dev');
await clip.shown('Local');
await pause(1500);
await clip.type('l');
await pause(1000);
await clip.visit('localhost:3100/posts');
await clip.write({ Title: 'Ferns are older than dinosaurs', Body: 'They were here first.' });

await clip.split('shell');
await clip.run('vim fronds/blog/entities/Post.ts');
await pause(1500);
await clip.type('f}hi');
await clip.type(', optional');
await clip.press('Escape');
await clip.run(':6');
await clip.type('osummary: optional(text({ min: 10 })),');
await pause(1500);
await clip.press('Escape');
await clip.run(':x');
await pause(3000);
await clip.reload('behind the entities');

await clip.run('pnpm migrate');
await clip.shown('applied');
await pause(1200);
await clip.run(`sqlite3 -box .data/app.db "select name, type from pragma_table_info('posts')"`);
await pause(2500);
await clip.reload('Summary');

await clip.write({ Title: 'Ferns grow without seeds', Body: 'Spores, carried by the wind.', Summary: 'short' });
await pause(1500);
await clip.run('http -b POST :3100/api/blog/posts title=Ferns body=Spores summary=short');
await pause(4000);
await clip.app.getByPlaceholder('Summary').pressSequentially(' and sweet.', { delay: 55 });
await pause(600);
await clip.app.getByRole('button', { name: 'Create draft' }).click();
await clip.end();
