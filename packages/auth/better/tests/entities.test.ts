import { describe, it, expect } from 'vitest';
import { entity, primary, text, bool, optional, isNullable } from '@fougere/schema';
import { toTable, createTableSQL } from '@fougere/adapter-sql';
import { AuthUser, AuthVerification, authEntities } from '../src/entities.js';

const { AuthSession, AuthAccount } = authEntities(AuthUser);

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

// ─── authEntities — the FK follows the resolved User, not AuthUser ─────────
//
// `ref()` fixes its target at field-declaration time (packages/adapter/sql's
// `referenceFor` reads `target.name` to derive the FK table when the target
// isn't part of the same generation batch — see its doc comment). Rendering
// each entity's DDL standalone (bare `toTable`, no batch) isolates exactly
// that: which class `userId` actually points at.

class Member extends entity({
  id: primary(),
  name: text(),
  email: text(),
  emailVerified: bool(),
  image: optional(text()),
}) {}

describe('authEntities — FK target', () => {
  it("session.user_id references the app's own User table when one is provided", () => {
    const { AuthSession } = authEntities(Member);
    const sql = createTableSQL(toTable('sessions', AuthSession), 'pg');
    expect(sql).toContain('references "members" ("id")');
    expect(sql).not.toContain('auth_users');
  });

  it("account.user_id references the app's own User table when one is provided", () => {
    const { AuthAccount } = authEntities(Member);
    const sql = createTableSQL(toTable('accounts', AuthAccount), 'pg');
    expect(sql).toContain('references "members" ("id")');
    expect(sql).not.toContain('auth_users');
  });

  it('falls back to AuthUser\'s own table when no User is provided', () => {
    const { AuthSession, AuthAccount } = authEntities(AuthUser);
    expect(createTableSQL(toTable('sessions', AuthSession), 'pg')).toContain('references "auth_users" ("id")');
    expect(createTableSQL(toTable('accounts', AuthAccount), 'pg')).toContain('references "auth_users" ("id")');
  });
});
