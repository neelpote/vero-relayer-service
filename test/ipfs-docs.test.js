require('ts-node/register');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateIpfsHash } = require('../src/utils/ipfs');

test('IPFS Docs Utility Tests', async (t) => {
  await t.test('validateIpfsHash accepts valid CIDv0 hashes', () => {
    assert.strictEqual(validateIpfsHash('QmXoypizjW3WknFixtdKLh4T72Yk9951wX9rEMe3c3b5A5'), true);
    assert.strictEqual(validateIpfsHash('QmYwAPJzv5CZ1aA5xKVrnzg2VWJqk5F37tqbvvqHCsLk3d'), true);
    assert.strictEqual(validateIpfsHash('QmTz991tW9bga7t3N3h7f7H3WwXbU2yM5n3K4a5b6c7d8e'), true);
  });

  await t.test('validateIpfsHash accepts valid base32 CIDv1 hashes', () => {
    assert.strictEqual(validateIpfsHash('bafybeigdyqzg2ndqct34adjg36jai24f5wqgkavqaqqswqqsqqqsqqqsqy'), true);
  });

  await t.test('validateIpfsHash rejects invalid hashes', () => {
    assert.strictEqual(validateIpfsHash(''), false);
    assert.strictEqual(validateIpfsHash('invalid_hash'), false);
    assert.strictEqual(validateIpfsHash('QmInvalidCharO01l_short'), false);
    assert.strictEqual(validateIpfsHash('QmXoypizjW3WknFixtdKLh4T72Yk9951wX9rEMe3c3b5A'), false);
    assert.strictEqual(validateIpfsHash('QmXoypizjW3WknFixtdKLh4T72Yk9951wX9rEMe3c3b5A55'), false);
  });
});
