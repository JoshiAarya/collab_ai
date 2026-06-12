import { describe, it, expect } from 'vitest';
import { validate, validators } from '../../src/middleware/validation.js';
import { ValidationError } from '../../src/middleware/errorHandler.js';

function run(schemaName, req) {
  return new Promise((resolve) => {
    validate(schemaName)(req, {}, (err) => resolve(err));
  });
}

describe('validators', () => {
  it('validates emails', () => {
    expect(validators.isEmail('a@b.co')).toBe(true);
    expect(validators.isEmail('not-an-email')).toBe(false);
  });

  it('validates ObjectIds', () => {
    expect(validators.isObjectId('507f1f77bcf86cd799439011')).toBe(true);
    expect(validators.isObjectId('nope')).toBe(false);
  });
});

describe('validate middleware', () => {
  it('passes a valid register payload', async () => {
    const err = await run('register', {
      body: { username: 'alice', email: 'alice@example.com', password: 'secret123' },
      params: {}, query: {}
    });
    expect(err).toBeUndefined();
  });

  it('rejects a missing required field', async () => {
    const err = await run('register', {
      body: { username: 'alice', email: 'alice@example.com' },
      params: {}, query: {}
    });
    expect(err).toBeInstanceOf(ValidationError);
  });

  it('does not let query params shadow body fields', async () => {
    // Body has a valid email; query tries to smuggle an invalid one.
    const err = await run('login', {
      body: { email: 'alice@example.com', password: 'secret123' },
      params: {},
      query: { email: 'spoofed-not-an-email' }
    });
    expect(err).toBeUndefined();
  });

  it('still fails when the only value is an invalid query param', async () => {
    const err = await run('login', {
      body: { password: 'secret123' },
      params: {},
      query: { email: 'not-an-email' }
    });
    expect(err).toBeInstanceOf(ValidationError);
  });
});
