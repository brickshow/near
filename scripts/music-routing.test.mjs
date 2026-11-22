import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function harness(spotify = false) {
  const calls = [], opened = [], cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = {}; cache[name] = exports;
    const code = ts.transpileModule(readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    runInNewContext(code, { exports, crypto: { randomUUID: () => 'test' }, require(id) {
      if (id === '@tauri-apps/api/event') return { listen: async () => () => {} };
      if (id === '@tauri-apps/api/core') return { invoke: async (command, args) => {
        calls.push({ command, args });
        if (command === 'media_play_spotify') return spotify;
        if (command === 'resolve_youtube_music') return { url: 'https://www.youtube.com/watch?v=abcdefghijk', matched: true, title: 'Amazing Grace Official Video' };
        return 'I cannot control music apps.';
      } };
      if (id === '@tauri-apps/plugin-opener') return { openUrl: async url => opened.push(url) };
      if (id.startsWith('./')) return load(id.slice(2));
      throw Error(id);
    } });
    return exports;
  }
  return { sendChat: load('chat').sendChat, calls, opened };
}
for (const mode of ['chat', 'voice']) {
  test(`${mode}: Spotify is tried before YouTube for a named song`, async () => {
    const h = harness();
    await h.sendChat([{ role: 'user', content: 'Can you play Amazing Grace?' }], undefined, { mode });
    assert.equal(h.calls[0].command, 'media_play_spotify');
    assert.equal(h.calls[1].command, 'resolve_youtube_music');
    assert.equal(h.calls[1].args.query, 'Amazing Grace');
    assert.equal(h.opened.length, 1);
    assert.equal(h.calls[2].command, 'media_play_youtube');
  });
}

test('successful Spotify playback skips YouTube', async () => {
  const h = harness(true);
  assert.match(await h.sendChat([{ role: 'user', content: 'Play music' }]), /Playing music on Spotify/);
  assert.deepEqual(h.calls.map(call => call.command), ['media_play_spotify']);
  assert.equal(h.opened.length, 0);
});

test('voice plays a default for a bare request and routes the next faith question to chat', async () => {
  const h = harness();
  const history = [{ role: 'user', content: 'Play music' }];
  const reply = await h.sendChat(history, undefined, { mode: 'voice' });
  assert.doesNotMatch(reply, /What song or kind of music/);
  assert.equal(h.calls.find(call => call.command === 'resolve_youtube_music')?.args.query, 'uplifting worship music');
  history.push({ role: 'assistant', content: reply }, { role: 'user', content: 'Please pray with me' });
  await h.sendChat(history, undefined, { mode: 'voice' });
  assert.equal(h.calls.at(-1).command, 'chatgpt_reply');
});
