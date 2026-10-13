import test from 'node:test';
import assert from 'node:assert/strict';
import { portableLock } from './portable-lock.js';

function fixture(name, url) {
  return {
    name: 'bizconnectpay', lockfileVersion: 3,
    packages: {
      '': { dependencies: { [name]: '1.0.2' } },
      [`node_modules/${name}`]: { version: '1.0.2', resolved: url, integrity: 'sha512-fixture' },
    },
  };
}

test('Normalizes private registry URLs without changing versions or checksums', () => {
  for (const name of ['wrappy', '@scope/package']) {
    const tarball = `${name}/-/${name.split('/').at(-1)}-1.0.2.tgz`;
    const input = fixture(name, `http://package-firewall.replit.internal/npm/${tarball}`);
    const output = portableLock(input);
    const packageName = `node_modules/${name}`;
    assert.equal(output.packages[packageName].resolved, `https://registry.npmjs.org/${tarball}`);
    assert.equal(output.packages[packageName].version, input.packages[packageName].version);
    assert.equal(output.packages[packageName].integrity, input.packages[packageName].integrity);
    assert.match(input.packages[packageName].resolved, /replit\.internal/);
    assert.deepEqual(output.packages[''], input.packages['']);
  }
});

test('Public locks remain unchanged and normalization is idempotent', () => {
  const input = fixture('wrappy', 'https://registry.npmjs.org/wrappy/-/wrappy-1.0.2.tgz');
  assert.deepEqual(portableLock(input), input);
  assert.deepEqual(portableLock(portableLock(input)), input);
});

test('Unknown private hosts, credentials, and missing integrity are rejected', () => {
  for (const url of [
    'http://another.replit.internal/npm/wrappy.tgz',
    'https://private.example.org/wrappy.tgz',
    'https://user:password@registry.npmjs.org/wrappy.tgz',
  ]) assert.throws(() => portableLock(fixture('wrappy', url)));
  const missing = fixture('wrappy', 'https://registry.npmjs.org/wrappy/-/wrappy-1.0.2.tgz');
  delete missing.packages['node_modules/wrappy'].integrity;
  assert.throws(() => portableLock(missing));
});
