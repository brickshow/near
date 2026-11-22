import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

function harness() {
  const module = { exports: {} };
  let listener;
  let disposed = false;
  const requests = [];
  const code = ts.transpileModule(readFileSync(new URL('../src/lib/chat.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(code, { module, exports: module.exports, crypto: { randomUUID: () => 'test-request' },
    require(name) {
      if (name === '@tauri-apps/api/event') return { listen: async (_event, handler) => {
        listener = handler;
        return () => { disposed = true; };
      } };
      if (name === '@tauri-apps/api/core') return { invoke: (command, args) => new Promise((resolve, reject) => requests.push({ command, args, resolve, reject })) };
      if (name === './musicCommands') return { createMusicCommands: () => async () => null };
      if (name === '@tauri-apps/plugin-opener') return { openUrl: async () => {} };
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return { ...module.exports, requests, disposed: () => disposed,
    delta: (delta, requestId = 'test-request') => listener({ payload: { requestId, delta } }),
  };
}

test('voice replies stream original spacing before completion and request the voice model', async () => {
  const h = harness();
  const chunks = [];
  const response = h.sendChat([{ role: 'user', content: 'Hello' }], (delta) => chunks.push(delta), { mode: 'voice' });
  await new Promise(setImmediate);
  assert.equal(h.requests[0].args.mode, 'voice');
  h.delta('Ignore me', 'another-request');
  h.delta('Hello,');
  h.delta(' brother!');
  assert.equal(chunks.join(''), 'Hello, brother!', 'Text should arrive before the request resolves');
  h.requests[0].resolve('Hello, brother! Good morning.');
  assert.equal(await response, 'Hello, brother! Good morning.');
  assert.equal(chunks.join(''), 'Hello, brother! Good morning.');
  assert.ok(h.disposed());
});

test('text chat defaults to its normal model and listeners clean up after failure', async () => {
  const h = harness();
  const response = h.sendChat([{ role: 'user', content: 'Hello' }]);
  await new Promise(setImmediate);
  assert.equal(h.requests[0].args.mode, 'chat');
  h.requests[0].reject(new Error('Connection failed'));
  await assert.rejects(response, /Connection failed/);
  assert.ok(h.disposed());
});
