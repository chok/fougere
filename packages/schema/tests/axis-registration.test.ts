import { describe, expect, it } from 'vitest';
import { Axes, Card, entity, Field, Format, primary, text, type Axis } from '../src/index.js';

interface TenancyRules {
  scope: 'tenant' | 'global';
}

const TENANCY_FORMAT = Format.of('https://acme.example/schema/axis/tenancy')
  .key('scope', Format.tokens(['tenant', 'global']))
  .needs('scope')
  .closed();

const tenancyAxis: Axis<TenancyRules, TenancyRules> = {
  slot: 'tenancy',
  format: TENANCY_FORMAT,

  describe: (value) => value,
  reconstruct: (wire) => wire,
};

const shape = { type: 'string' } as const;
const stating = (tenancy: unknown) => () => new Field({ shape, tenancy } as never, 'owner');

/**
 * An axis a package declares outside `@fougere/schema`: the key is refused until it is
 * registered, and from then on it is judged, kept and carried like the three core ones.
 */
describe('an axis registered from outside', () => {
  it('has no legal key until it registers, and the refusal names the ones that are', () => {
    expect(stating({ scope: 'tenant' })).toThrow(
      'tenancy: Instance does not match any of ["shape","role","lifecycle","boundary","meta"].',
    );

    Axes.register(tenancyAxis.slot, tenancyAxis);

    expect(stating({ scope: 'tenant' })).not.toThrow();
  });

  it('is judged by the format it brought', () => {
    expect(stating({ scope: 'both' })).toThrow(
      `Field 'owner': tenancy.scope: Instance does not match any of ["tenant","global"].`,
    );
    expect(stating({ scope: 'tenant', nawak: 1 })).toThrow(
      `Field 'owner': tenancy.nawak: Instance does not match any of ["scope"].`,
    );
  });

  it('keeps its slot on the field, and travels on a card', () => {
    class Doc extends entity({
      id: primary(),
      owner: new Field<string>({ shape, tenancy: { scope: 'tenant' } } as never),
      title: text(),
    }) {}

    expect((Doc.getFields().owner as unknown as { tenancy: TenancyRules }).tenancy).toEqual({
      scope: 'tenant',
    });

    const descriptor = Card.fromSchema(Doc, 'doc').descriptor;
    expect(descriptor.properties.owner['x-fougere']?.tenancy).toEqual({ scope: 'tenant' });

    const rebuilt = Card.fromDescriptor(descriptor).toSchema();
    expect((rebuilt.getFields().owner as unknown as { tenancy: TenancyRules }).tenancy).toEqual({
      scope: 'tenant',
    });
  });
});
