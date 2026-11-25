import { describe, it, expect } from 'vitest';
import { ServiceTypes } from '@fougere/core';
import '../src/index.js';

describe('a service', () => {
  it('runs its command, as written', () => {
    expect(ServiceTypes.commandOf({ type: 'process', port: 7700, command: 'meilisearch' } as never, 'meili')).toBe('meilisearch');
  });

  it('runs a Docker image on its port, named after the service', () => {
    expect(ServiceTypes.commandOf({ type: 'docker', port: 9000, image: 'minio/minio', args: 'server /data' } as never, 'minio'))
      .toBe('docker run --rm --name fougere-minio -p 9000:9000 minio/minio server /data');
  });

  it('refuses a key its type does not know, under its own name', () => {
    expect(() => ServiceTypes.commandOf({ type: 'docker', port: 9000, image: 'minio/minio', comand: 'x' } as never, 'minio'))
      .toThrow(/services\.minio/);
  });

  it('refuses a type nothing registered, naming the ones there are', () => {
    expect(() => ServiceTypes.commandOf({ type: 'k8s', port: 1 } as never, 'meili')).toThrow(/services\.meili\.type/);
  });
});
