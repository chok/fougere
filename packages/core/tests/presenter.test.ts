import { describe, it, expect } from 'vitest';
import { Presenter, getPresenterFields } from '../src/presenter.js';
import { targetOf } from '../src/prefab.js';

class FakeEntity {
  static getFields() {
    return { id: { type: 'id' }, name: { type: 'text' } };
  }
}

class ProductPresenter extends Presenter(FakeEntity) {
  excerpt(products: any[]) {
    return products.map((p) => p.name.slice(0, 10));
  }

  isExpensive(products: any[]) {
    return products.map((p) => p.price > 100);
  }
}

describe('Presenter', () => {
  it('stores the target entity on the class', () => {
    expect(targetOf(ProductPresenter)).toBe(FakeEntity);
  });

  it('returns undefined for non-presenter classes', () => {
    class NotAPresenter {}
    expect(targetOf(NotAPresenter)).toBeUndefined();
  });

  it('lists computed field names (methods only, no constructor)', () => {
    const fields = getPresenterFields(ProductPresenter);
    expect(fields).toContain('excerpt');
    expect(fields).toContain('isExpensive');
    expect(fields).not.toContain('constructor');
  });

  it('methods are callable on an instance', () => {
    const presenter = new ProductPresenter();
    expect(presenter.excerpt([{ name: 'Long Product Name' }])).toEqual(['Long Produ']);
    expect(presenter.isExpensive([{ price: 200 }, { price: 50 }])).toEqual([true, false]);
  });
});
