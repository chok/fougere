import { describe, it, expect } from 'vitest';
import { Presenter, getPresenterTarget, getPresenterFields } from '../src/presenter.js';

class FakeEntity {
  static getFields() {
    return { id: { type: 'id' }, name: { type: 'text' } };
  }
}

class ProductPresenter extends Presenter(FakeEntity) {
  excerpt(product: any) {
    return product.name.slice(0, 10);
  }

  isExpensive(product: any) {
    return product.price > 100;
  }
}

describe('Presenter', () => {
  it('stores the target entity on the class', () => {
    expect(getPresenterTarget(ProductPresenter)).toBe(FakeEntity);
  });

  it('returns undefined for non-presenter classes', () => {
    class NotAPresenter {}
    expect(getPresenterTarget(NotAPresenter)).toBeUndefined();
  });

  it('lists computed field names (methods only, no constructor)', () => {
    const fields = getPresenterFields(ProductPresenter);
    expect(fields).toContain('excerpt');
    expect(fields).toContain('isExpensive');
    expect(fields).not.toContain('constructor');
  });

  it('methods are callable on an instance', () => {
    const presenter = new ProductPresenter();
    expect(presenter.excerpt({ name: 'Long Product Name' })).toBe('Long Produ');
    expect(presenter.isExpensive({ price: 200 })).toBe(true);
    expect(presenter.isExpensive({ price: 50 })).toBe(false);
  });
});
