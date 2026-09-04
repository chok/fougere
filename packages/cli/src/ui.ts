/** Fougere CLI UI — beautiful terminal interface. */
import * as clack from '@clack/prompts';
import pc from 'picocolors';
import { consola } from 'consola';
import { defaultTheme, type ThemeColors } from './theme.js';

export interface UiTheme {
  colors?: Partial<ThemeColors>;
}

export function ui(options?: UiTheme) {
  const c = { ...defaultTheme, ...options?.colors };

  return {
    // ── Lifecycle ─────────────────────────────────

    /** Start a new CLI session with a branded header. */
    intro(title = 'Fougere') {
      clack.intro(c.brand(title));
    },

    /** End the session with a message. */
    outro(message: string) {
      clack.outro(c.success(message));
    },

    /** Cancel and exit. */
    cancel(message = 'Cancelled.') {
      clack.cancel(c.muted(message));
      process.exit(0);
    },

    // ── Prompts ───────────────────────────────────

    /** Text input. */
    async text(opts: { message: string; placeholder?: string; defaultValue?: string; validate?: (value: string) => string | undefined }) {
      const result = await clack.text(opts);
      if (clack.isCancel(result)) { this.cancel(); return ''; }
      return result as string;
    },

    /** Yes/no confirmation. */
    async confirm(opts: { message: string; initialValue?: boolean }) {
      const result = await clack.confirm(opts);
      if (clack.isCancel(result)) { this.cancel(); return false; }
      return result as boolean;
    },

    /** Select one from a list. */
    async select(opts: {
      message: string;
      options: { value: string; label?: string; hint?: string }[];
      initialValue?: string;
    }) {
      const result = await clack.select(opts as Parameters<typeof clack.select>[0]);
      if (clack.isCancel(result)) { this.cancel(); return ''; }
      return result as string;
    },

    /** Multi-select from a list. */
    async multiselect(opts: {
      message: string;
      options: { value: string; label?: string; hint?: string }[];
      required?: boolean;
    }) {
      const result = await clack.multiselect(opts as Parameters<typeof clack.multiselect>[0]);
      if (clack.isCancel(result)) { this.cancel(); return [] as string[]; }
      return result as string[];
    },

    // ── Spinner ───────────────────────────────────

    /** Start a spinner. Returns stop/update functions. */
    spinner(message?: string) {
      const s = clack.spinner();
      s.start(message);
      return {
        update: (msg: string) => s.message(msg),
        stop: (msg?: string) => s.stop(msg),
      };
    },

    // ── Output ────────────────────────────────────

    /** Informational message. */
    info(message: string) {
      clack.log.info(message);
    },

    /** Success message. */
    success(message: string) {
      clack.log.success(c.success(message));
    },

    /** Warning message. */
    warn(message: string) {
      clack.log.warn(c.warn(message));
    },

    /** Error message. */
    error(message: string) {
      clack.log.error(c.error(message));
    },

    /** Step indicator. */
    step(message: string) {
      clack.log.step(message);
    },

    /** Note box — multiline content in a box. */
    note(message: string, title?: string) {
      clack.note(message, title);
    },

    // ── Raw colors/consola ────────────────────────

    colors: c,
    pc,
    consola,
  };
}
