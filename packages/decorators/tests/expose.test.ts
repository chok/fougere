import { describe, it, expect } from 'vitest';
import { expose, isExposed, getExposedMethods } from '../src/index.js';

describe('@expose', () => {
  describe('class decorator', () => {
    @expose
    class User {
      id = 1;
      name = 'test';
    }

    class Session {
      id = 1;
      token = 'abc';
    }

    it('marks decorated class as exposed', () => {
      expect(isExposed(User)).toBe(true);
    });

    it('unmarked class is not exposed', () => {
      expect(isExposed(Session)).toBe(false);
    });
  });

  describe('combined class + method decorator', () => {
    @expose
    class AuthHandler {
      @expose
      login() { return true; }

      @expose
      logout() { return true; }

      internal() { return false; }
    }

    it('class is exposed', () => {
      expect(isExposed(AuthHandler)).toBe(true);
    });

    it('exposed methods are collected', () => {
      const methods = getExposedMethods(AuthHandler);
      expect(methods.has('login')).toBe(true);
      expect(methods.has('logout')).toBe(true);
      expect(methods.has('internal')).toBe(false);
    });
  });

  describe('method decorator only', () => {
    class OrderService {
      @expose
      list() { return []; }

      @expose
      findById(_id: string) { return null; }

      recalculate() { return 0; }
    }

    it('collects exposed method names', () => {
      const methods = getExposedMethods(OrderService);
      expect(methods.has('list')).toBe(true);
      expect(methods.has('findById')).toBe(true);
    });

    it('does not include non-decorated methods', () => {
      const methods = getExposedMethods(OrderService);
      expect(methods.has('recalculate')).toBe(false);
    });
  });

  describe('class without any @expose methods', () => {
    class Plain {
      doStuff() { return 1; }
    }

    it('returns empty set', () => {
      expect(getExposedMethods(Plain).size).toBe(0);
    });
  });
});
