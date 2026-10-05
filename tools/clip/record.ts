import { chromium } from '@playwright/test';

const out = process.argv[2]!;
const browser = await chromium.launch();
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A video starts when its page opens, so each clock is read right after one. */
async function film(width: number) {
  const context = await browser.newContext({
    viewport: { width, height: 640 },
    colorScheme: 'dark',
    recordVideo: { dir: `${out}/${width}`, size: { width, height: 640 } },
  });
  const page = await context.newPage();

  return { page, opened: Date.now() };
}

const terminal = await film(720);
await terminal.page.goto('http://localhost:7681');
await pause(1500);
await terminal.page.keyboard.type('fougere serve blog', { delay: 60 });
await terminal.page.keyboard.press('Enter');
for (;;) {
  try {
    await fetch('http://127.0.0.1:4100/_fougere/call', { method: 'POST' });
    break;
  } catch {
    await pause(100);
  }
}
await pause(1200);

const { page, opened } = await film(640);
await page.goto('http://localhost:3100/posts');
await pause(1200);
await page.getByPlaceholder(/title/i).pressSequentially('Ferns are older than dinosaurs', { delay: 45 });
await page.locator('textarea').first().pressSequentially('Some 360 million years.', { delay: 35 });
await pause(400);
await page.getByRole('button', { name: 'Create draft' }).click();
await pause(1800);
await page.getByRole('button', { name: 'Publish' }).hover();
await pause(500);
await page.getByRole('button', { name: 'Publish' }).click();
await pause(3000);
await browser.close();

console.log(((opened - terminal.opened) / 1000).toFixed(2));
