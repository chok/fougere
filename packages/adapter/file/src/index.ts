/** Files — one per instance, a directory per entity, in JSON or YAML. */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { Format, lowerFirst, Visibility, type Accepted, type SchemaView } from '@fougere/schema';
import {
  Sources, storageOver,
  type Store, type Values, type Source, type SourceView,
} from '@fougere/core';

/** How a row is written, read off the file's extension. Both hold a date as text. */
const FORMATS = {
  json: { extensions: ['.json'], parse: (text: string): unknown => JSON.parse(text), stringify: (values: Values) => JSON.stringify(values, null, 2) },
  yaml: { extensions: ['.yaml', '.yml'], parse: (text: string): unknown => parseYaml(text), stringify: (values: Values) => stringifyYaml(values) },
} as const;

type FileFormat = keyof typeof FORMATS;

const FORMAT_NAMES = Object.keys(FORMATS) as FileFormat[];

function formatOf(file: string): FileFormat | undefined {
  const extension = extname(file);

  return FORMAT_NAMES.find((format) => (FORMATS[format].extensions as readonly string[]).includes(extension));
}

/** A key becomes a filename, so it may not leave the directory it addresses. */
function nameOf(key: string): string {
  if (key.includes('/') || key.includes('\\') || key === '.' || key === '..') {
    throw new Error(`source 'file': the key '${key}' cannot be used as a file name.`);
  }

  return encodeURIComponent(key);
}

/** One file per key, under `dir`. A read decodes the dates back. */
function fileStore(dir: string, entity: SchemaView, written: FileFormat): Store & { fileOf(key: string): string | undefined } {
  const visibility = Visibility.of(entity.getFields());
  const read = async (file: string): Promise<Values> =>
    visibility.decode(FORMATS[formatOf(file)!].parse(await readFile(file, 'utf8')) as Values);

  // A key is one row whatever its extension, so `s1.json` beside `s1.yaml` is two answers to one key.
  const fileOf = (key: string): string | undefined => {
    const base = nameOf(key);
    const found = FORMAT_NAMES
      .flatMap((format) => FORMATS[format].extensions)
      .map((extension) => join(dir, base + extension))
      .filter((file) => existsSync(file));
    if (found.length > 1) {
      throw new Error(`source 'file': the row '${key}' is written twice — ${found.join(' and ')}. Keep one.`);
    }

    return found[0];
  };

  return {
    client: dir,
    fileOf,
    get: async (key) => {
      const file = fileOf(key);

      return file === undefined ? undefined : read(file);
    },
    has: async (key) => fileOf(key) !== undefined,
    set: async (key, values) => {
      await mkdir(dir, { recursive: true });
      const file = fileOf(key) ?? join(dir, nameOf(key) + FORMATS[written].extensions[0]);

      await writeFile(file, FORMATS[formatOf(file)!].stringify(values), 'utf8');
    },
    delete: async (key) => {
      const file = fileOf(key);
      if (file === undefined) return false;
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
      const keys = new Set(names
        .filter((file) => formatOf(file) !== undefined)
        .map((file) => decodeURIComponent(file.slice(0, -extname(file).length))));

      return Promise.all([...keys].map((key) => read(fileOf(key)!)));
    },
  };
}

export interface FileSourceOptions {
  /** The directory the entity directories sit under. */
  path: string;
  /** What a new row is written in — `json` when unsaid. A row already on disk keeps its own. */
  format?: FileFormat;
}

export function createFileSource(opts: FileSourceOptions): Source {
  const written = opts.format ?? 'json';
  // A value is one file named after its entity, beside the directories that hold rows.
  const values = (entity: SchemaView) => fileStore(opts.path, entity, written);

  return {
    storageFactory: storageOver((entity, name) => fileStore(join(opts.path, name), entity, written)),
    name: opts.path,
    value: (entity, name) => values(entity).get(lowerFirst(name)),
    valueAt: (entity, name) => values(entity).fileOf(lowerFirst(name))
      ?? `${join(opts.path, lowerFirst(name))}.${FORMAT_NAMES.join('|')}, which does not exist`,
    // A directory IS the shape, so bringing it up to date is making it exist. `elsewhere`
    // is not read: nothing here emits a constraint, so a cross-source `ref()` costs nothing.
    migrate: async (view: SourceView) => {
      for (const name of view.entities.keys()) {
        await mkdir(join(opts.path, lowerFirst(name)), { recursive: true });
      }
    },
    pending: async (view: SourceView) =>
      [...view.entities.keys()]
        .map(lowerFirst)
        .filter((name) => !existsSync(join(opts.path, name)))
        .map((name) => `${join(opts.path, name)} — no directory`),
  };
}

const FILE = Format.of('source/file')
  .key('type', Format.tokens(['file']))
  .key('path', Format.text)
  .key('format', Format.tokens(FORMAT_NAMES))
  .needs('type', 'path')
  .closed();

declare module '@fougere/core' {
  interface FougereSources {
    file: Accepted<typeof FILE>;
  }
}

Sources.register('file', { format: FILE, open: (entry) => createFileSource({ path: entry.path, format: entry.format }) });
