import type { Fact, Pipe } from '@fougere/core';
import type Account from '../entities/Account.js';
import type Receipt from '../entities/Receipt.js';

export default class ListenerHandler {
  async heardOne(fact: Fact<Receipt>): Promise<void> {}

  async heardTwo(fact: Fact<Account | Receipt>): Promise<void> {}

  async finished(fact: Pipe<Account | Receipt>): Promise<Account> {
    return fact as Account;
  }
}
