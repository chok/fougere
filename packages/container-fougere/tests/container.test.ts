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

// --- Tests ---

describe('Container (fougere)', () => {
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

    it('resolves a factory function', () => {
      const container = createContainer();
      container.registerValue('dbUrl', 'sqlite://test.db');
      container.register('connection', (c) => ({ url: c.resolve('dbUrl') }));

      const conn = container.resolve<{ url: string }>('connection');
      expect(conn.url).toBe('sqlite://test.db');
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

    it('singleton returns the same instance', () => {
      const container = createContainer();
      container.register('Logger', Logger, { lifetime: 'singleton' });
      const a = container.resolve('Logger');
      const b = container.resolve('Logger');
      expect(a).toBe(b);
    });

    it('scoped returns the same instance within a scope', () => {
      const container = createContainer();
      container.register('Logger', Logger, { lifetime: 'scoped' });

      const scope1 = container.createScope();
      const scope2 = container.createScope();

      const a = scope1.resolve('Logger');
      const b = scope1.resolve('Logger');
      const c = scope2.resolve('Logger');

      expect(a).toBe(b);       // same scope → same instance
      expect(a).not.toBe(c);   // different scope → different instance
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

  describe('dispose', () => {
    it('can be disposed without error', async () => {
      const container = createContainer();
      container.register('Logger', Logger);
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
