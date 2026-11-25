import { describe, it, expect } from 'vitest';
import { addressVariableOf, environmentOf } from '../src/config/Environment.js';

const config = {
  services: {
    meili: { type: 'docker', port: 7700, health: '/health' },
    cache: { type: 'docker', port: 6379, scheme: 'redis' },
  },
  processes: {
    blog: { url: 'http://127.0.0.1:4100', fronds: ['blog'] },
    mail: { url: 'http://mail:4200', fronds: ['mail'] },
  },
} as never;

describe('what a process is told', () => {
  it('names each service by the variable the env source reads a value off', () => {
    expect(addressVariableOf('meili')).toBe('MEILI_URL');
    expect(addressVariableOf('object-store')).toBe('OBJECT_STORE_URL');
  });

  it('gives the app every service address, in its own scheme', () => {
    expect(environmentOf(config, undefined, {})).toEqual({ MEILI_URL: 'http://127.0.0.1:7700', CACHE_URL: 'redis://127.0.0.1:6379' });
  });

  it('keeps an address the environment already gives, since that service runs elsewhere', () => {
    expect(environmentOf(config, undefined, { MEILI_URL: 'https://meili.staging' }).MEILI_URL).toBe('https://meili.staging');
  });

  it('gives a process its name, where it listens and where its neighbours answer', () => {
    expect(environmentOf(config, 'blog', {})).toMatchObject({
      FOUGERE_PROCESS: 'blog',
      FOUGERE_LISTEN: '127.0.0.1:4100',
      FOUGERE_PEERS: '{"mail":"http://mail:4200"}',
      MEILI_URL: 'http://127.0.0.1:7700',
    });
  });
});
