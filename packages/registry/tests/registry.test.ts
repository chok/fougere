import { describe, it, expect } from 'vitest';
import { Registry, RegistryError } from '../src/index.js';

const ulid = () => 'u';
const other = () => 'o';

describe('Registry', () => {
  it('keeps the one answer a name has', () => {
    const point = new Registry<() => string>('generator');
    point.register('ulid', ulid);

    expect(point.resolve('ulid')).toBe(ulid);
  });

  it('takes the same answer twice without a word', () => {
    const point = new Registry<() => string>('generator');
    point.register('ulid', ulid);

    expect(() => point.register('ulid', ulid)).not.toThrow();
  });

  it('refuses a second answer under a name, naming the point', () => {
    const point = new Registry<() => string>('generator');
    point.register('ulid', ulid);

    expect(() => point.register('ulid', other)).toThrow(RegistryError);
    expect(() => point.register('ulid', other)).toThrow(/'ulid' is answered twice for generator/);
    expect(point.resolve('ulid')).toBe(ulid);
  });

  it('replaces when told to, and refuses to replace what answers nothing', () => {
    const point = new Registry<() => string>('generator');
    point.register('ulid', ulid);
    point.replace('ulid', other);

    expect(point.resolve('ulid')).toBe(other);
    expect(() => point.replace('cuid', ulid)).toThrow(/'cuid' answers nothing for generator yet/);
  });

  it('lets a reload replace, and tells who reloaded', async () => {
    const point = new Registry<() => string>('generator');
    point.register('ulid', ulid);
    const replaced: string[] = [];

    await Registry.reloading(async () => { point.register('ulid', other); }, (label, name) => replaced.push(`${label}:${name}`));

    expect(point.resolve('ulid')).toBe(other);
    expect(replaced).toEqual(['generator:ulid']);
    expect(() => point.register('ulid', ulid)).toThrow(RegistryError);
  });

  it('keeps the order answers came in', () => {
    const point = new Registry<number>('source', undefined, [['fact', 1], ['pipe', 2]]);
    point.register('collector', 3);

    expect(point.names).toEqual(['fact', 'pipe', 'collector']);
  });

  it('names what the process answers when a name answers nothing', () => {
    const point = new Registry<number>('source type', 'import the adapter that answers it', [['sqlite', 1]]);

    expect(() => point.resolve('redis', 'sources.cache.type'))
      .toThrow("sources.cache.type: Unknown source type 'redis' — import the adapter that answers it. This process answers sqlite.");
  });
});

describe('Registry.every', () => {
  it('lists every registry the process made, by its label and the names it answers', () => {
    new Registry<number>('probe kind', undefined, [['first', 1]]);

    expect(Registry.every()).toContainEqual({ label: 'probe kind', names: ['first'] });
  });
});
