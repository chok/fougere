import { describe, expect, it } from 'vitest';
import { page } from '../src/page.js';

const html = page('probe');
const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));

/**
 * The page's own script is a STRING to TypeScript, so nothing type-checks it and a missing
 * parenthesis ships as a blank screen. Twice now the build stayed green while the page was
 * broken; parsing it here is the only guard that sees it.
 */
describe('the page', () => {
  it('parses as JavaScript', () => {
    expect(() => new Function(script)).not.toThrow();
  });

  it('serves four views, and each has a tab', () => {
    for (const view of ['calls', 'refused', 'activity', 'shape', 'served']) {
      expect(html).toContain(`href="#${view}"`);
      expect(script).toContain(`function ${view}(`);
    }
    // Six grew one tab at a time and read as noise. A sixth needs a decision, not a commit.
    expect(html.match(/href="#/g)).toHaveLength(5);
  });

  it('escapes what it renders', () => {
    // Everything on this page comes from the app being watched — an operation name, a log
    // line, a SQL statement. None of it is trusted markup.
    const esc = new Function(script.slice(script.indexOf('const esc'), script.indexOf('const routeOf'))
      + 'return esc;')() as (v: unknown) => string;

    expect(esc('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(esc('a "quoted" & thing')).toBe('a &quot;quoted&quot; &amp; thing');
  });
});
