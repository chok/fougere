/**
 * A frond reaching into another one by file path.
 *
 * `verify()` answers "does this survive a split?" from the MODEL — what a constructor
 * asks for, what a parameter is typed. This question cannot be answered there: a relative
 * import leaves no trace in the model at all, which is precisely what makes it costly.
 * So the rule reads source, and lives in its own file for that reason.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { crossFrondImports } from '../src/node.js';

const frond = (name: string, path: string) => ({ name, source: { path, package: `@fronds/${name}` } });

describe('a relative import that leaves its frond', () => {
  it('is found, and the message names the frond it lands in', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-imports-'));
    try {
      mkdirSync(join(root, 'blog', 'handlers'), { recursive: true });
      mkdirSync(join(root, 'user', 'entities'), { recursive: true });
      writeFileSync(join(root, 'user', 'entities', 'User.ts'), 'export default class User {}\n');
      writeFileSync(join(root, 'blog', 'handlers', 'PostHandler.ts'),
        `import User from '../../user/entities/User.js';\nexport default class PostHandler { x(u: User) { return u; } }\n`);

      const found = await crossFrondImports([frond('blog', join(root, 'blog')), frond('user', join(root, 'user'))]);

      expect(found).toHaveLength(1);
      expect(found[0].frond).toBe('blog');
      expect(found[0].target).toBe('user');
      expect(found[0].specifier).toBe('../../user/entities/User.js');
      expect(found[0].message).toContain("'@fronds/user/…'");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('says nothing about a frond that only reads its own files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-imports-'));
    try {
      mkdirSync(join(root, 'blog', 'handlers', 'public'), { recursive: true });
      mkdirSync(join(root, 'blog', 'entities'), { recursive: true });
      writeFileSync(join(root, 'blog', 'entities', 'Post.ts'), 'export default class Post {}\n');
      // Two dots and still at home — the reason the rule resolves instead of counting them.
      writeFileSync(join(root, 'blog', 'handlers', 'public', 'PostHandler.ts'),
        `import Post from '../../entities/Post.js';\nexport default class PostHandler { x(p: Post) { return p; } }\n`);

      expect(await crossFrondImports([frond('blog', join(root, 'blog'))])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('leaves the named form alone — it is the remedy, not the offence', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-imports-'));
    try {
      mkdirSync(join(root, 'blog', 'handlers'), { recursive: true });
      mkdirSync(join(root, 'user', 'entities'), { recursive: true });
      writeFileSync(join(root, 'user', 'entities', 'User.ts'), 'export default class User {}\n');
      writeFileSync(join(root, 'blog', 'handlers', 'PostHandler.ts'),
        `import User from '@fronds/user/entities/User.js';\nexport default class PostHandler { x(u: User) { return u; } }\n`);

      expect(await crossFrondImports([frond('blog', join(root, 'blog')), frond('user', join(root, 'user'))])).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('reads imports the way TypeScript does, not the way a regex would', async () => {
    const root = mkdtempSync(join(tmpdir(), 'fougere-imports-'));
    try {
      mkdirSync(join(root, 'blog'), { recursive: true });
      // A specifier inside a comment is not an import, and a re-export is one. A rule
      // that scans text gets both wrong, and a wrong finding is worse than none: it
      // teaches its reader to skip the category.
      writeFileSync(join(root, 'blog', 'Notes.ts'), [
        `// import Old from '../../elsewhere/Old.js';`,
        `/** See '../../other/Thing.js' for the reason. */`,
        `export { default } from '../../shared/Thing.js';`,
        ``,
      ].join('\n'));

      const found = await crossFrondImports([frond('blog', join(root, 'blog'))]);
      expect(found.map((f) => f.specifier)).toEqual(['../../shared/Thing.js']);
      // It lands in no frond at all, and the message says that rather than inventing one.
      expect(found[0].target).toBeUndefined();
      expect(found[0].message).toContain('into no frond at all');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
