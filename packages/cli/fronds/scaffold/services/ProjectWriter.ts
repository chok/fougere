import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export default class ProjectWriter {
  scaffold(dir: string, name: string, template: string): { path: string } {
    mkdirSync(join(dir, 'fronds'), { recursive: true });
    mkdirSync(join(dir, 'app', 'pages'), { recursive: true });

    writeFileSync(join(dir, 'fougere.config.ts'), [
      `import type { FougereConfig } from '@fougere/core';`,
      ``,
      `export default {`,
      `  db: 'sqlite',`,
      `} satisfies FougereConfig;`,
      ``,
    ].join('\n'));

    writeFileSync(join(dir, 'package.json'), JSON.stringify({
      name,
      private: true,
      type: 'module',
      scripts: { dev: 'nuxt dev', build: 'nuxt build' },
      dependencies: {
        '@fougere/core': 'latest',
        '@fougere/nuxt': 'latest',
        '@fougere/schema': 'latest',
        '@fougere/schema-drizzle': 'latest',
        '@fougere/container-fougere': 'latest',
        'better-sqlite3': '^11.0.0',
        'drizzle-orm': '^0.44.0',
        nuxt: '^4.4.0',
      },
    }, null, 2) + '\n');

    writeFileSync(join(dir, 'nuxt.config.ts'), [
      `export default defineNuxtConfig({`,
      `  modules: ['@fougere/nuxt'],`,
      `  compatibilityDate: '${new Date().toISOString().slice(0, 10)}',`,
      `});`,
      ``,
    ].join('\n'));

    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
      extends: './.nuxt/tsconfig.json',
    }, null, 2) + '\n');

    writeFileSync(join(dir, 'app', 'app.vue'), [
      `<template>`,
      `  <NuxtPage />`,
      `</template>`,
      ``,
    ].join('\n'));

    writeFileSync(join(dir, 'pnpm-workspace.yaml'), [
      'packages:',
      '  - fronds/*',
      '',
    ].join('\n'));

    const starters: Record<string, () => void> = {
      blog: () => this.writeStarterBlog(dir),
      api: () => this.writeStarterApi(dir),
      admin: () => this.writeStarterAdmin(dir),
    };
    starters[template]?.();

    // Index page — links to generated frond pages
    this.writeIndexPage(dir, template);

    return { path: dir };
  }

  /**
   * Scaffold a new frond inside an existing project.
   * Creates the frond directory structure with a package.json.
   */
  scaffoldFrond(projectDir: string, frondName: string): { path: string } {
    const frondDir = join(projectDir, 'fronds', frondName);
    mkdirSync(join(frondDir, 'entities'), { recursive: true });
    mkdirSync(join(frondDir, 'handlers'), { recursive: true });

    writeFileSync(join(frondDir, 'package.json'), JSON.stringify({
      name: `@frond/${frondName}`,
      version: '0.0.1',
      type: 'module',
      fougere: { frond: frondName },
      exports: {
        './entities/*': './entities/*.ts',
        './package.json': './package.json',
      },
    }, null, 2) + '\n');

    return { path: frondDir };
  }

  private writeIndexPage(dir: string, template: string) {
    const links: Record<string, { frond: string; entity: string }> = {
      blog: { frond: 'blog', entity: 'posts' },
      api: { frond: 'api', entity: 'tasks' },
      admin: { frond: 'admin', entity: 'users' },
    };
    const link = links[template];

    const crudLink = link
      ? `<li><a href="/${link.frond}/${link.entity}">CRUD — /${link.frond}/${link.entity}</a></li>`
      : '';
    const apiLink = link
      ? `<li><a href="/api/${link.frond}/${link.entity}">REST API — /api/${link.frond}/${link.entity}</a></li>`
      : '';

    writeFileSync(join(dir, 'app', 'pages', 'index.vue'), [
      `<template>`,
      `  <div style="max-width: 600px; margin: 4rem auto; font-family: system-ui; line-height: 1.6;">`,
      `    <h1>&#x1F33F; ${template}</h1>`,
      `    <p>Your Fougere project is running.</p>`,
      `    <ul>`,
      ...(crudLink ? [`      ${crudLink}`] : []),
      ...(apiLink ? [`      ${apiLink}`] : []),
      `    </ul>`,
      `    <p style="margin-top: 2rem; color: #888; font-size: 0.9rem;">`,
      `      Edit <code>fronds/</code> to add entities and handlers. They appear here automatically.`,
      `    </p>`,
      `  </div>`,
      `</template>`,
      ``,
    ].join('\n'));
  }

  private writeStarterBlog(dir: string) {
    const frond = this.scaffoldFrond(dir, 'blog');

    writeFileSync(join(frond.path, 'entities', 'Post.ts'), [
      `import { entity, primary, text, auto } from '@fougere/schema';`,
      ``,
      `export default class Post extends entity({`,
      `  id: primary(),`,
      `  title: text({ min: 1, max: 200 }),`,
      `  body: text(),`,
      `  createdAt: auto(),`,
      `}) {}`,
      ``,
    ].join('\n'));

    writeFileSync(join(frond.path, 'handlers', 'PostHandler.ts'), [
      `import { Crud } from '@fougere/core';`,
      `import Post from '../entities/Post.js';`,
      ``,
      `export default class PostHandler extends Crud(Post) {}`,
      ``,
    ].join('\n'));
  }

  private writeStarterApi(dir: string) {
    const frond = this.scaffoldFrond(dir, 'api');

    writeFileSync(join(frond.path, 'entities', 'Task.ts'), [
      `import { entity, primary, text, bool } from '@fougere/schema';`,
      ``,
      `export default class Task extends entity({`,
      `  id: primary(),`,
      `  title: text({ min: 1, max: 200 }),`,
      `  done: bool(),`,
      `}) {}`,
      ``,
    ].join('\n'));

    writeFileSync(join(frond.path, 'handlers', 'TaskHandler.ts'), [
      `import { Crud } from '@fougere/core';`,
      `import Task from '../entities/Task.js';`,
      ``,
      `export default class TaskHandler extends Crud(Task) {}`,
      ``,
    ].join('\n'));
  }

  private writeStarterAdmin(dir: string) {
    const frond = this.scaffoldFrond(dir, 'admin');

    writeFileSync(join(frond.path, 'entities', 'User.ts'), [
      `import { entity, primary, text } from '@fougere/schema';`,
      ``,
      `export default class User extends entity({`,
      `  id: primary(),`,
      `  name: text({ min: 1, max: 100 }),`,
      `  email: text({ min: 5 }),`,
      `  role: text(),`,
      `}) {}`,
      ``,
    ].join('\n'));

    writeFileSync(join(frond.path, 'handlers', 'UserHandler.ts'), [
      `import { Crud } from '@fougere/core';`,
      `import User from '../entities/User.js';`,
      ``,
      `export default class UserHandler extends Crud(User) {}`,
      ``,
    ].join('\n'));
  }
}
