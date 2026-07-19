import { describe, it, expect } from 'vitest';
import { isNullable } from '@fougere/schema';
import { AuthUser, AuthSession, AuthAccount, AuthVerification } from '../src/entities.js';

describe('AuthUser', () => {
  it('matches better-auth user shape', () => {
    const fields = AuthUser.getFields();
    expect(Object.keys(fields).sort()).toEqual(
      ['createdAt', 'email', 'emailVerified', 'id', 'image', 'name', 'updatedAt'].sort(),
    );
    expect(fields.id.role?.primary).toBe(true);
    expect(isNullable(fields.email.shape)).toBe(false);
    expect(fields.emailVerified.shape?.type).toBe('boolean');
    expect(isNullable(fields.image.shape)).toBe(true);
  });
});

describe('AuthSession', () => {
  it('has token + expiresAt + ipAddress + userAgent', () => {
    const fields = AuthSession.getFields();
    expect('token' in fields).toBe(true);
    expect('expiresAt' in fields).toBe(true);
    expect('ipAddress' in fields).toBe(true);
    expect('userAgent' in fields).toBe(true);
    expect(isNullable(fields.ipAddress.shape)).toBe(true);
  });

  it('id is single primary key', () => {
    const fields = AuthSession.getFields();
    expect(fields.id.role?.primary).toBe(true);
  });
});

describe('AuthAccount', () => {
  it('has single id PK and accountId/providerId pair', () => {
    const fields = AuthAccount.getFields();
    expect(fields.id.role?.primary).toBe(true);
    expect(fields.accountId.role?.primary).toBeFalsy();
    expect(fields.providerId.role?.primary).toBeFalsy();
  });

  it('exposes separate token columns and password slot', () => {
    const fields = AuthAccount.getFields();
    expect('accessToken' in fields).toBe(true);
    expect('refreshToken' in fields).toBe(true);
    expect('idToken' in fields).toBe(true);
    expect('password' in fields).toBe(true);
    expect(isNullable(fields.accessToken.shape)).toBe(true);
    expect(isNullable(fields.password.shape)).toBe(true);
  });
});

describe('AuthVerification', () => {
  it('matches better-auth verification shape', () => {
    const fields = AuthVerification.getFields();
    expect(Object.keys(fields).sort()).toEqual(
      ['createdAt', 'expiresAt', 'id', 'identifier', 'updatedAt', 'value'].sort(),
    );
  });
});
