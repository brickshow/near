import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import worker from '../src/worker.mjs';

// Execute the real migration and Worker SQL against SQLite, rather than mocking
// activation results. D1's small binding surface is adapted to node:sqlite.
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../migrations/0001_preview.sql', import.meta.url), 'utf8'));
  const DB = {
    withSession(mode) { assert.equal(mode, 'first-primary'); return this; },
    prepare(sql) {
      const statement = sqlite.prepare(sql);
      let args = [];
      return { bind(...values) { args = values; return this; }, async run() { return statement.run(...args); }, async first() { return statement.get(...args) ?? null; } };
    },
  };
  async function request(path = 'activate', token = 'a'.repeat(64), extra = {}) {
    const response = await worker.fetch(new Request(`https://preview.example/v1/${path}`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, ...extra,
    }), { DB });
    return { response, body: response.headers.get('content-type')?.includes('json') ? await response.json() : await response.text() };
  }
  return { sqlite, request, DB };
}
test('first launch is exactly 72 hours; restart/reinstall/retry retain the dates', async () => {
  const { request, sqlite } = fixture();
  const before = await request('status');
  assert.equal(before.body.state, 'preview_not_activated');
  assert.equal(sqlite.prepare('SELECT count(*) n FROM preview_activations').get().n, 0);
  const first = (await request()).body;
  assert.equal(first.state, 'preview_active');
  assert.equal(first.expiresAt - first.activatedAt, 259200);
  for (const path of ['status', 'activate', 'activate']) {
    const result = (await request(path)).body;
    assert.equal(result.activatedAt, first.activatedAt);
    assert.equal(result.expiresAt, first.expiresAt);
  }
  assert.equal(sqlite.prepare('SELECT count(*) n FROM preview_activations').get().n, 1);
});
test('parallel activation attempts are idempotent', async () => {
  const { request, sqlite } = fixture();
  const results = await Promise.all(Array.from({ length: 12 }, () => request()));
  assert.equal(new Set(results.map(r => r.body.expiresAt)).size, 1);
  assert.equal(sqlite.prepare('SELECT count(*) n FROM preview_activations').get().n, 1);
});
test('closing activations preserves existing active and expired previews', async () => {
  const { request, sqlite } = fixture();
  await request();
  sqlite.exec('UPDATE preview_config SET activations_enabled=0');
  assert.equal((await request()).body.state, 'preview_active');
  const denied = (await request('activate', 'b'.repeat(64))).body;
  assert.equal(denied.state, 'preview_not_activated');
  assert.equal(denied.activationsEnabled, false);
  sqlite.exec('UPDATE preview_activations SET activated_at=unixepoch()-259200, expires_at=unixepoch()');
  assert.equal((await request()).body.state, 'preview_expired');
});
test('client clock and supplied dates cannot extend or restart an expired preview', async () => {
  const { request, sqlite } = fixture();
  await request();
  sqlite.exec('UPDATE preview_activations SET activated_at=unixepoch()-259201, expires_at=unixepoch()-1');
  const first = (await request('status')).body;
  const retry = (await request('activate', 'a'.repeat(64), { body: JSON.stringify({ serverNow: 0, expiresAt: 9999999999 }) })).body;
  assert.equal(retry.state, 'preview_expired');
  assert.equal(first.expiresAt, retry.expiresAt);
});
test('database stores only a token hash and immutable timing data', async () => {
  const { request, sqlite } = fixture();
  await request();
  const row = sqlite.prepare('SELECT * FROM preview_activations').get();
  assert.equal(row.token_hash.length, 64);
  assert.notEqual(row.token_hash, 'a'.repeat(64));
  assert.deepEqual(Object.keys(row).sort(), ['activated_at', 'expires_at', 'token_hash']);
});
test('invalid tokens fail; responses are uncached; no checkout endpoint exists', async () => {
  const { request } = fixture();
  assert.equal((await request('activate', 'invalid')).response.status, 401);
  assert.equal((await request()).response.headers.get('cache-control'), 'no-store');
  assert.equal((await request('checkout')).response.status, 404);
});
test('network/database failure returns a retryable error and never fabricates a grant', async () => {
  const response = await worker.fetch(new Request('https://preview.example/v1/activate', {
    method: 'POST', headers: { Authorization: `Bearer ${'a'.repeat(64)}` },
  }), { DB: { withSession() { throw new Error('Unavailable'); } } });
  assert.equal(response.status, 503);
  assert.equal(await response.text(), 'Preview service temporarily unavailable');
});
