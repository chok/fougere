/**
 * An extension may put what it brings into a frond's scope, and step over an answer before the view
 * projects it — the two doors a module needs to live outside core.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { createApp, createAppRunner, frond, Invocation, type Extension } from '../src/index.js';
import { op } from './contract.js';

class Greeting {
  constructor(readonly word: string) {}
}

class HelloHandler {
  constructor(private greeting: Greeting) {}
  async getHello() { return { text: this.greeting.word }; }
}

const greeter = (word: string): Extension => ({
  name: 'greeter',
  install(_frond, { scope }) { scope.registerValue('Greeting', new Greeting(word)); },
  steps: () => [async (answered) => ({ ...(answered as object), stepped: true })],
});

const app = (extensions: Extension[]) => createApp({
  createContainer,
  storageFactory: () => ({}) as never,
  fronds: [frond('hello', {
    handlers: [{ ctor: HelloHandler, deps: ['Greeting'], operations: { getHello: op({ cardinality: 'one' }) } }],
  })],
  extensions,
});

describe('the doors of an extension', () => {
  it('installs into the frond scope and steps over the answer', async () => {
    await using booted = await app([greeter('bonjour')]);

    await expect(createAppRunner(booted)({ address: 'hello', op: 'getHello' }, Invocation.empty))
      .resolves.toEqual({ text: 'bonjour', stepped: true });
  });

  it('refuses the boot when nothing installs what a handler asks for', async () => {
    await expect(app([])).rejects.toThrow(/HelloHandler asks for Greeting/);
  });
});
