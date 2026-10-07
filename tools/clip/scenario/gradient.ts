import { pause, take, tmux } from '../take.ts';

const clip = await take();

await clip.run('pnpm dev');
await clip.shown('Local');
await pause(1500);
await clip.type('l');
await pause(1000);
await clip.visit('localhost:3100/posts');
await clip.write({ Title: 'Ferns are older than dinosaurs', Body: 'They were here first.' });

await clip.split('config');
await clip.run('vim +/fronds fougere.config.ts');
await pause(1500);
await clip.type('$hhi');
await clip.type(", blog: 'http://127.0.0.1:4100'");
await pause(1500);
await clip.press('Escape');
await clip.run(':x');
await pause(3000);
await clip.reload('No reachable remote');

tmux('select-pane', '-T', 'blog');
await clip.run('fougere serve blog');
await clip.shown('Ctrl-C to stop');
await pause(1200);
await clip.reload();
await clip.write({ Title: 'Ferns grow without seeds', Body: 'Spores, carried by the wind.' });
await clip.app.getByRole('button', { name: 'Publish' }).first().hover();
await pause(600);
await clip.app.getByRole('button', { name: 'Publish' }).first().click();
await clip.end();
