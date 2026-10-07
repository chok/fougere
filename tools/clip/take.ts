import { chromium, type FrameLocator, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

export const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const tmux = (...args: string[]) => execFileSync('tmux', ['-L', 'clip', ...args], { encoding: 'utf8' });

/** What every pane shows, so a scenario that stops says where. */
function stuck(message: string) {
  const panes = tmux('list-panes', '-F', '#{pane_index}').trim().split('\n');
  const screens = panes.map((pane) => tmux('capture-pane', '-p', '-t', `clip:0.${pane}`));

  return new Error(`${message}\n${screens.join('\n────\n')}`);
}

const screen = () => tmux('capture-pane', '-p', '-t', 'clip:0').trim();

export async function until(ready: () => boolean | Promise<boolean>, what: string) {
  const deadline = Date.now() + 60_000;
  while (!(await ready())) {
    if (Date.now() > deadline) throw stuck(`Still waiting for ${what} after 60s`);
    await pause(200);
  }
}

/** The width of a README's column, so the clip is shown at its own size. */
const width = 800;

/** Two cameras on one clock: the terminal above, the browser below. */
export async function take() {
  const out = process.argv[2]!;
  const browser = await chromium.launch();

  /**
   * A video starts when its page opens, so each clock is read right after one. A `scale` under 1
   * films a larger window into the same frame, the way a browser zoomed out shows more.
   */
  async function film(name: string, height: number, scale = 1): Promise<{ page: Page; opened: number }> {
    const context = await browser.newContext({
      viewport: { width: Math.round(width / scale), height: Math.round(height / scale) },
      colorScheme: 'dark',
      recordVideo: { dir: `${out}/${name}`, size: { width, height } },
    });
    const page = await context.newPage();

    return { page, opened: Date.now() };
  }

  const terminal = await film('terminal', 720);
  await terminal.page.goto('http://localhost:7681');
  const { page, opened } = await film('page', 440, 0.65);
  await page.goto(new URL('browser.html', import.meta.url).href);
  await pause(1500);
  const app: FrameLocator = page.frameLocator('iframe');

  /** Typed through tmux rather than the page: xterm.js drops keys vim is waiting on. */
  async function type(text: string) {
    for (const character of text) {
      tmux('send-keys', '-l', character);
      await pause(60);
    }
  }

  return {
    app,
    type,
    async press(key: string) {
      tmux('send-keys', key);
      await pause(250);
    },
    async run(command: string) {
      await type(command);
      tmux('send-keys', 'Enter');
    },
    async shown(text: string) {
      await until(() => screen().includes(text), `'${text}' in the terminal`);
    },
    async split(title: string) {
      tmux('split-window', '-v');
      tmux('select-pane', '-T', title);
      await pause(800);
    },
    async visit(address: string) {
      await page.getByRole('textbox', { name: 'Address' }).pressSequentially(address, { delay: 70 });
      await page.keyboard.press('Enter');
      await pause(1500);
    },
    async reload(until?: string) {
      for (let attempt = 0; ; attempt++) {
        await page.getByRole('button', { name: 'Reload' }).click();
        await pause(2500);
        if (!until || (await app.locator('body').innerHTML()).includes(until)) return;
        if (attempt === 4) throw stuck(`The page never showed '${until}':\n${await app.locator('body').innerText()}`);
      }
    },
    async write(fields: Record<string, string>) {
      for (const [placeholder, text] of Object.entries(fields)) {
        await app.getByPlaceholder(placeholder).pressSequentially(text, { delay: 55 });
      }
      await pause(600);
      await app.getByRole('button', { name: 'Create draft' }).click();
      await pause(2500);
    },
    async end() {
      await pause(3500);
      await browser.close();
      console.log(((opened - terminal.opened) / 1000).toFixed(2));
    },
  };
}
