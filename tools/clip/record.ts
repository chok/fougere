import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const out = process.argv[2]!;
const browser = await chromium.launch();
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const tmux = (...args: string[]) => execFileSync('tmux', ['-L', 'clip', ...args], { encoding: 'utf8' });
const answers = (url: string, init?: RequestInit) => fetch(url, init).then((response) => response.text(), () => '');

async function until(ready: () => boolean | Promise<boolean>, what: string) {
  const deadline = Date.now() + 60_000;
  while (!(await ready())) {
    if (Date.now() > deadline) throw new Error(`Still waiting for ${what} after 60s`);
    await pause(200);
  }
}

/** A video starts when its page opens, so each clock is read right after one. */
async function film(name: string, height: number) {
  const context = await browser.newContext({
    viewport: { width: 1200, height },
    colorScheme: 'dark',
    recordVideo: { dir: `${out}/${name}`, size: { width: 1200, height } },
  });
  const page = await context.newPage();

  return { page, opened: Date.now() };
}

const terminal = await film('terminal', 380);
await terminal.page.goto('http://localhost:7681');
const { page, opened } = await film('page', 560);
await page.goto(new URL('browser.html', import.meta.url).href);
const keyboard = terminal.page.keyboard;
const posts = page.frameLocator('iframe');
const reload = async () => {
  await page.getByRole('button', { name: 'Reload' }).click();
  await pause(2500);
};
await pause(1500);

await keyboard.type('pnpm dev', { delay: 80 });
await keyboard.press('Enter');
await until(async () => (await answers('http://localhost:3100/')).includes('Fougere'), 'Nuxt to answer');
await pause(1000);
await page.getByRole('textbox', { name: 'Address' }).pressSequentially('localhost:3100/posts', { delay: 70 });
await page.keyboard.press('Enter');
await posts.getByRole('heading', { name: 'Posts' }).waitFor();
await pause(1500);
await posts.getByPlaceholder(/title/i).pressSequentially('Ferns are older than dinosaurs', { delay: 60 });
await posts.locator('textarea').first().pressSequentially('They were here first.', { delay: 50 });
await pause(600);
await posts.getByRole('button', { name: 'Create draft' }).click();
await pause(2500);

tmux('split-window', '-h');
tmux('select-pane', '-T', 'config');
await pause(800);
await keyboard.type('vim +5 fougere.config.ts', { delay: 60 });
await keyboard.press('Enter');
await pause(1500);
for (const key of ['$', 'h', 'h', 'i']) {
  await keyboard.type(key);
  await pause(250);
}
await keyboard.type(", blog: 'http://127.0.0.1:4100'", { delay: 60 });
await pause(1500);
await keyboard.press('Escape');
await keyboard.type(':x', { delay: 150 });
await pause(400);
await keyboard.press('Enter');
await until(async () => (await answers('http://localhost:3100/posts')).includes('No reachable remote'), 'the page to refuse');
await pause(800);
await reload();

tmux('select-pane', '-T', 'blog');
await keyboard.type('fougere serve blog', { delay: 60 });
await keyboard.press('Enter');
await until(async () => (await answers('http://127.0.0.1:4100/_fougere/call', { method: 'POST' })) !== '', 'blog to answer');
await pause(1200);
await reload();
await posts.getByPlaceholder(/title/i).pressSequentially('Ferns grow without seeds', { delay: 60 });
await posts.locator('textarea').first().pressSequentially('Spores, carried by the wind.', { delay: 50 });
await pause(600);
await posts.getByRole('button', { name: 'Create draft' }).click();
await pause(2500);
await posts.getByRole('button', { name: 'Publish' }).first().hover();
await pause(600);
await posts.getByRole('button', { name: 'Publish' }).first().click();
await pause(3500);
await browser.close();

console.log(((opened - terminal.opened) / 1000).toFixed(2));
