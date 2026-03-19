import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { hashApiKey } from './apiKeyHash';

describe('hashApiKey', () => {
  const originalEnv = process.env.KEY_VAULTS_SECRET;

  beforeEach(() => {
    delete process.env.KEY_VAULTS_SECRET;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.KEY_VAULTS_SECRET = originalEnv;
    } else {
      delete process.env.KEY_VAULTS_SECRET;
    }
  });

  it('should throw when KEY_VAULTS_SECRET is not set', () => {
    expect(() => hashApiKey('sk-test-key')).toThrow(
      '`KEY_VAULTS_SECRET` is required for API key hash calculation.',
    );
  });

  it('should throw when KEY_VAULTS_SECRET is empty string', () => {
    process.env.KEY_VAULTS_SECRET = '';
    expect(() => hashApiKey('sk-test-key')).toThrow(
      '`KEY_VAULTS_SECRET` is required for API key hash calculation.',
    );
  });

  it('should return a 64-character hex string (SHA-256)', () => {
    process.env.KEY_VAULTS_SECRET = 'test-secret';
    const hash = hashApiKey('sk-lh-abc123');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[\da-f]{64}$/);
  });

  it('should produce the same hash for the same input and secret', () => {
    process.env.KEY_VAULTS_SECRET = 'test-secret';
    const hash1 = hashApiKey('sk-lh-abc123');
    const hash2 = hashApiKey('sk-lh-abc123');
    expect(hash1).toBe(hash2);
  });

  it('should produce different hashes for different API keys', () => {
    process.env.KEY_VAULTS_SECRET = 'test-secret';
    const hash1 = hashApiKey('sk-lh-key-one');
    const hash2 = hashApiKey('sk-lh-key-two');
    expect(hash1).not.toBe(hash2);
  });

  it('should produce different hashes when the secret changes', () => {
    process.env.KEY_VAULTS_SECRET = 'secret-a';
    const hash1 = hashApiKey('sk-lh-abc123');

    process.env.KEY_VAULTS_SECRET = 'secret-b';
    const hash2 = hashApiKey('sk-lh-abc123');

    expect(hash1).not.toBe(hash2);
  });

  it('should handle an empty API key string', () => {
    process.env.KEY_VAULTS_SECRET = 'test-secret';
    const hash = hashApiKey('');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[\da-f]{64}$/);
  });

  it('should produce a known hash for a fixed input and secret', () => {
    // Pre-computed: echo -n "sk-lh-testkey" | openssl dgst -sha256 -hmac "fixed-secret"
    const { createHmac } = require('node:crypto');
    const expected = createHmac('sha256', 'fixed-secret').update('sk-lh-testkey').digest('hex');

    process.env.KEY_VAULTS_SECRET = 'fixed-secret';
    expect(hashApiKey('sk-lh-testkey')).toBe(expected);
  });
});
