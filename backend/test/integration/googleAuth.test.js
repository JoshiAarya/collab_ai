import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import authService from '../../src/services/authService.js';
import User from '../../src/models/User.js';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('authService.googleAuth', () => {
  it('links Google to an existing email/password account instead of failing with a duplicate-email error', async () => {
    const { user: local } = await authService.register('dana', 'dana@example.com', 'password123');

    const { user: linked } = await authService.googleAuth('google-123', 'dana@example.com', 'Dana');

    // Same account, now carrying the googleId — no duplicate created.
    expect(linked._id.toString()).toBe(local._id.toString());
    expect(await User.countDocuments({ email: 'dana@example.com' })).toBe(1);

    const stored = await User.findById(local._id);
    expect(stored.googleId).toBe('google-123');
    // Password login still works — the password is preserved on link.
    expect(stored.password).toBeTruthy();
  });

  it('creates a new account when no user has that email', async () => {
    const { user } = await authService.googleAuth('google-456', 'eve@example.com', 'Eve');

    expect(user.email).toBe('eve@example.com');
    const stored = await User.findOne({ googleId: 'google-456' });
    expect(stored).toBeTruthy();
    expect(stored.authProvider).toBe('google');
  });

  it('returns the same account on repeat Google logins (matched by googleId)', async () => {
    const first = await authService.googleAuth('google-789', 'frank@example.com', 'Frank');
    const second = await authService.googleAuth('google-789', 'frank@example.com', 'Frank');

    expect(second.user._id.toString()).toBe(first.user._id.toString());
    expect(await User.countDocuments({ googleId: 'google-789' })).toBe(1);
  });

  it('matches the existing email case-insensitively when linking', async () => {
    const { user: local } = await authService.register('grace', 'grace@example.com', 'password123');

    const { user: linked } = await authService.googleAuth('google-999', 'Grace@Example.com', 'Grace');

    expect(linked._id.toString()).toBe(local._id.toString());
    expect(await User.countDocuments({})).toBe(1);
  });
});
