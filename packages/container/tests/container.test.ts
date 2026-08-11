import { describe, it, expect } from 'vitest';
import { createContainer } from '../src/index.js';

// --- Test fixtures ---

class Logger {
  log(msg: string) { return msg; }
}

class UserRepository {
  findAll() { return ['alice', 'bob']; }
}

class UserService {
  constructor(
    private userRepository: UserRepository,
    private logger: Logger,
  ) {}

  getUsers() {
    this.logger.log('fetching users');
    return this.userRepository.findAll();
  }
}

/** Records that it was told, and in which order relative to its siblings. */
const closing = (log: string[], name: string) =>
  class {
    async dispose() { log.push(name); }
  };

// --- Tests ---

describe('Container', () => {
  describe('register + resolve', () => {
    it('resolves a class with no dependencies', () => {
      const container = createContainer();
      container.register('Logger', Logger);
      const logger = container.resolve<Logger>('Logger');
      expect(logger.log('hi')).toBe('hi');
    });

    it('resolves dependencies by type name (deps option)', () => {
      const container = createContainer();
      container.register('Logger', Logger);
      container.register('UserRepository', UserRepository);
      container.register('UserService', UserService, { deps: ['UserRepository', 'Logger'] });

      const service = container.resolve<UserService>('UserService');
      expect(service.getUsers()).toEqual(['alice', 'bob']);
    });

    it('resolves a pre-built value', () => {
      const container = createContainer();
      container.registerValue('config', { port: 3000 });
      expect(container.resolve('config')).toEqual({ port: 3000 });
    });
  });

  describe('has()', () => {
    it('returns true for registered names', () => {
      const container = createContainer();
      container.register('Logger', Logger);
      expect(container.has('Logger')).toBe(true);
      expect(container.has('unknown')).toBe(false);
    });
  });

  describe('lifetime', () => {
    it('transient creates a new instance each time', () => {
      const container = createContainer();
      container.register('Logger', Logger, { lifetime: 'transient' });
      const a = container.resolve('Logger');
      const b = container.resolve('Logger');
      expect(a).not.toBe(b);
    });

    it('transient is the default', () => {
      const container = createContainer();
      container.register('Logger', Logger);
      expect(container.resolve('Logger')).not.toBe(container.resolve('Logger'));
    });

    it('singleton returns the same instance', () => {
      const container = createContainer();
      container.register('Logger', Logger, { lifetime: 'singleton' });
      const a = container.resolve('Logger');
      const b = container.resolve('Logger');
      expect(a).toBe(b);
    });
  });

  describe('scope', () => {
    it('child scope inherits parent registrations', () => {
      const container = createContainer();
      container.register('Logger', Logger);

      const scope = container.createScope();
      const logger = scope.resolve<Logger>('Logger');
      expect(logger.log('scoped')).toBe('scoped');
    });

    it('child scope can override parent registrations', () => {
      const container = createContainer();
      container.registerValue('config', { env: 'prod' });

      const scope = container.createScope();
      scope.registerValue('config', { env: 'test' });

      expect(container.resolve('config')).toEqual({ env: 'prod' });
      expect(scope.resolve('config')).toEqual({ env: 'test' });
    });
  });

  describe('fallback', () => {
    it('fabricates what no scope holds', () => {
      const container = createContainer();
      container.setFallback?.((name) => (name === 'remote' ? { made: true } : undefined));

      expect(container.resolve('remote')).toEqual({ made: true });
      expect(() => container.resolve('other')).toThrow();
    });

    it('is inherited by a child scope', () => {
      const container = createContainer();
      container.setFallback?.(() => ({ made: true }));
      expect(container.createScope().resolve('anything')).toEqual({ made: true });
    });
  });

  describe('dispose', () => {
    it('tells the singletons it kept, most recent first', async () => {
      const log: string[] = [];
      const container = createContainer();
      container.register('First', closing(log, 'first'), { lifetime: 'singleton' });
      container.register('Second', closing(log, 'second'), { lifetime: 'singleton' });
      container.resolve('First');
      container.resolve('Second');

      await container.dispose();

      expect(log).toEqual(['second', 'first']);
    });

    it('says nothing to a singleton nobody ever resolved', async () => {
      const log: string[] = [];
      const container = createContainer();
      container.register('Unused', closing(log, 'unused'), { lifetime: 'singleton' });

      await container.dispose();

      expect(log).toEqual([]);
    });

    it('does not dispose a transient — its caller owns it', async () => {
      const log: string[] = [];
      const container = createContainer();
      container.register('Handler', closing(log, 'handler'));
      container.resolve('Handler');

      await container.dispose();

      expect(log).toEqual([]);
    });

    it('does not dispose a value it did not build', async () => {
      const log: string[] = [];
      const container = createContainer();
      container.registerValue('db', { dispose: async () => { log.push('db'); } });
      container.resolve('db');

      await container.dispose();

      expect(log).toEqual([]);
    });

    it('tells everyone even when one refuses, then reports together', async () => {
      const log: string[] = [];
      const container = createContainer();
      container.register('Bad', class { dispose() { throw new Error('nope'); } }, { lifetime: 'singleton' });
      container.register('Good', closing(log, 'good'), { lifetime: 'singleton' });
      container.resolve('Bad');
      container.resolve('Good');

      await expect(container.dispose()).rejects.toThrow(AggregateError);
      expect(log).toEqual(['good']);
    });

    it('ignores an instance with no dispose method', async () => {
      const container = createContainer();
      container.register('Logger', Logger, { lifetime: 'singleton' });
      container.resolve('Logger');
      await expect(container.dispose()).resolves.toBeUndefined();
    });
  });

  describe('errors', () => {
    it('throws on unregistered dependency', () => {
      const container = createContainer();
      expect(() => container.resolve('nope')).toThrow();
    });
  });
});
