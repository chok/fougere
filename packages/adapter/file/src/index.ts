/**
 * Rows as files — one JSON per row, a directory per entity.
 *
 * The reason this package is short: `storageOver` derives the thirteen gestures from four,
 * so a source that keeps rows somewhere else supplies only where. Nothing about pages,
 * criteria or lifecycle stamps is written twice.
 *
 * What it costs, said here rather than discovered: `all()` reads the whole directory, so
 * `list` with a `where` or an `orderBy` filters in memory. That is the same trade
 * `@fougere/adapter-duckdb` documents for a page-sized read — fine for a few thousand rows
 * held for their durability, wrong on a hot read path. And two processes over one directory
 * have no lock: SQLite has one, a filesystem does not.
 *
 * No `transacted` — a directory has no unit of work, so a frame compensates and says so.
 * `migrate` is a `mkdir` per entity, which is the whole shape a directory has.
 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lowerFirst } from '@fougere/schema';
import {
  Sources, storageOver,
  type Row, type Rows, type Source, type SourceConfig, type SourceView,
} from '@fougere/core';

/** A key becomes a filename, so it may not leave the directory it addresses. */
function fileOf(dir: string, key: string): string {
  if (key.includes('/') || key.includes('\\') || key === '.' || key === '..') {
    throw new Error(`source 'file': '${key}' cannot be a filename — a key becomes one here.`);
  }

  return join(dir, `${encodeURIComponent(key)}.json`);
}

/** One entity's rows, one file each, under `<root>/<entity>/`. */
function dirRows(root: string, name: string): Rows {
  const dir = join(root, name);
  const read = async (file: string): Promise<Row | undefined> => {
    try {
      return JSON.parse(await readFile(file, 'utf8')) as Row;
    } catch (error) {
      if ((error as { code?: string }).code === 'ENOENT') return undefined;
      throw error;
    }
  };

  return {
    client: dir,
    get: (key) => read(fileOf(dir, key)),
    has: async (key) => (await read(fileOf(dir, key))) !== undefined,
    set: async (key, row) => {
      await mkdir(dir, { recursive: true });
      await writeFile(fileOf(dir, key), JSON.stringify(row, null, 2), 'utf8');
    },
    delete: async (key) => {
      const file = fileOf(dir, key);
      if ((await read(file)) === undefined) return false;
      await rm(file);
      return true;
    },
    all: async () => {
      let names: string[];
      try {
        names = await readdir(dir);
      } catch (error) {
        if ((error as { code?: string }).code === 'ENOENT') return [];
        throw error;
      }
      const rows = await Promise.all(names
        .filter((file) => file.endsWith('.json'))
        .map((file) => read(join(dir, file))));

      return rows.filter((row): row is Row => row !== undefined);
    },
  };
}

export interface FileSourceOptions {
  /** The directory the entity directories sit under. */
  path: string;
}

export function setupFile(opts: FileSourceOptions): Source {
  return {
    storageFactory: storageOver((_entity, name) => dirRows(opts.path, name)),
    name: opts.path,
    // A directory IS the shape, so bringing it up to date is making it exist. `elsewhere`
    // is not read: nothing here emits a constraint, so a cross-source `ref()` costs nothing.
    migrate: async (view: SourceView) => {
      for (const frond of view.fronds) {
        for (const entry of frond.entities) {
          await mkdir(join(opts.path, lowerFirst(entry.name)), { recursive: true });
        }
      }
    },
  };
}

Sources.register('file', (conf: SourceConfig): Source => {
  const path = conf.path as string | undefined;
  if (!path) {
    throw new Error("source 'file': no `path` — a directory is what it is told to open.");
  }

  return setupFile({ path });
});
