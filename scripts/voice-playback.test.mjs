import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const source = (name) => readFileSync(new URL(`../src/lib/${name}.ts`, import.meta.url), 'utf8');
function loadModule(text, globals = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(code, { module, exports: module.exports, ...globals });
  return module.exports;
}
const speechChunks = loadModule(source('speechChunks'));
const { splitSpeechText } = speechChunks;
const flush = () => new Promise((resolve) => setImmediate(resolve));
const encodedAudio = Buffer.from('mock WAV bytes').toString('base64');

function harness({ playbackError = false } = {}) {
  const requests = [], audio = [], urls = new Set(), utterances = [];
  const timers = new Map();
  let nextTimer = 0;
  let nextUrl = 0;
  class MockAudio {
    constructor(url) { this.src = url; audio.push(this); }
    play() {
      if (playbackError) return Promise.reject(new Error('Playback failed'));
      queueMicrotask(() => this.onplaying?.());
      return Promise.resolve();
    }
    pause() { this.paused = true; }
    load() {}
    removeAttribute() { this.src = ''; }
    end() { this.onended?.(); }
  }
  const voice = loadModule(source('voice'), {
    require(name) {
      if (name === './speechChunks') return speechChunks;
      if (name === '@tauri-apps/api/core') return { invoke: (command, args) => new Promise((resolve, reject) => requests.push({ command, ...args, resolve, reject })) };
      throw new Error(`Unexpected import: ${name}`);
    },
    Blob, Uint8Array, atob, Audio: MockAudio,
    URL: { createObjectURL() { const url = `blob:${++nextUrl}`; urls.add(url); return url; }, revokeObjectURL(url) { urls.delete(url); } },
    localStorage: { getItem: () => 'piper:en_US-bryce-medium' },
    window: { setTimeout: (callback) => { timers.set(++nextTimer, callback); return nextTimer; }, clearTimeout: (id) => timers.delete(id), requestAnimationFrame: () => 1, cancelAnimationFrame() {}, speechSynthesis: { cancel() {}, getVoices: () => [], speak: (utterance) => utterances.push(utterance) } },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
  });
  const callbacks = { start: 0, end: 0, errors: [] };
  const speak = (text, preferred = 'piper:en_US-bryce-medium', options) => {
    const handle = voice.speakNear(text, preferred, options);
    if (handle) {
      handle.onstart = () => callbacks.start++;
      handle.onend = () => callbacks.end++;
      handle.onerror = (error) => callbacks.errors.push(error);
    }
    return handle;
  };
  const advanceTimers = () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((callback) => callback()); };
  return { ...voice, speak, requests, audio, urls, utterances, callbacks, timers, advanceTimers };
}

test('chunks preserve the full text and bound even long, unpunctuated input', () => {
  for (const text of ["Hello, Brix. I'm NEAR. Read Genesis 1:1, then pray.", 'A long sentence '.repeat(400), '🙏'.repeat(500), 'A'.repeat(500)]) {
    const chunks = splitSpeechText(text);
    assert.equal(chunks.join('').replace(/\s/g, ''), text.replace(/\s/g, ''));
    assert.ok(Array.from(chunks[0]).length <= 160);
    assert.ok(chunks.slice(1).every((chunk) => Array.from(chunk).length <= 300));
  }
  assert.equal(splitSpeechText('   ').length, 0);
});

test('first sentence plays before later audio is ready; completion fires only after the final audio ends', async () => {
  const h = harness();
  h.speak('Hello, Brix. I am NEAR. Let us pray.');
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].text, 'Hello, Brix.');
  h.requests[0].resolve(encodedAudio);
  await flush();
  assert.equal(h.audio.length, 1);
  assert.equal(h.requests.length, 2, 'Only one future chunk should be prepared');
  assert.equal(h.callbacks.start, 1);
  assert.equal(h.audio[0].playbackRate, 1.1);
  assert.equal(h.audio[0].preservesPitch, true);
  h.audio[0].end();
  await flush();
  assert.equal(h.callbacks.end, 0);
  h.requests[1].resolve(encodedAudio);
  await flush();
  h.requests[2].resolve(encodedAudio);
  await flush();
  assert.equal(h.audio.length, 2, 'Prefetch must not start overlapping playback');
  h.audio[1].end();
  await flush();
  assert.equal(h.audio.length, 3);
  assert.equal(h.callbacks.end, 0);
  h.audio[2].end();
  await flush();
  assert.equal(h.callbacks.start, 1);
  assert.equal(h.callbacks.end, 1);
  assert.equal(h.urls.size, 0);
});

test('Stop during generation never starts late audio', async () => {
  const h = harness();
  h.speak('Hello. This must not play.');
  await flush();
  h.stopNearVoice();
  h.requests[0].resolve(encodedAudio);
  await flush();
  assert.equal(h.audio.length, 0);
  assert.equal(h.requests.length, 1);
  assert.equal(h.callbacks.end, 0);
});

test('Stop during playback discards prefetched audio and releases the player', async () => {
  const h = harness();
  h.speak('One. Two. Three.');
  await flush();
  h.requests[0].resolve(encodedAudio);
  await flush();
  h.stopNearVoice();
  h.requests[1].resolve(encodedAudio);
  await flush();
  assert.equal(h.requests.length, 2);
  assert.equal(h.audio.length, 1);
  assert.equal(h.audio[0].paused, true);
  assert.equal(h.callbacks.end, 0);
  assert.equal(h.urls.size, 0);
});

test('rapid replacements skip obsolete requests; Replay uses cached audio', async () => {
  const h = harness();
  h.speak('Obsolete greeting.');
  h.stopNearVoice();
  h.speak('Latest greeting.');
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].text, 'Latest greeting.');
  h.requests[0].resolve(encodedAudio);
  await flush();
  h.audio[0].end();
  await flush();
  h.speak('Latest greeting.', undefined, { rate: 1.1 });
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.audio.length, 2);
  assert.equal(h.audio[1].playbackRate, 1.1, 'Explicit intro speed must not be multiplied twice');
  h.stopNearVoice();
});

test('prefetch failure reports once after the current chunk; future speech still works', async () => {
  const h = harness();
  h.speak('One. Two.');
  await flush();
  h.requests[0].resolve(encodedAudio);
  await flush();
  h.requests[1].reject(new Error('Engine unavailable'));
  await flush();
  h.audio[0].end();
  await flush();
  assert.equal(h.callbacks.errors.length, 1);
  assert.equal(h.callbacks.end, 0);
  h.speak('Retry.');
  await flush();
  h.requests[2].resolve(encodedAudio);
  await flush();
  assert.equal(h.audio.length, 2);
  h.stopNearVoice();
});

test('audio playback rejection cleans up and does not signal successful completion', async () => {
  const h = harness({ playbackError: true });
  h.speak('Hello.');
  await flush();
  h.requests[0].resolve(encodedAudio);
  await flush();
  assert.equal(h.callbacks.errors.length, 1);
  assert.equal(h.callbacks.end, 0);
  assert.equal(h.urls.size, 0);
});

test('system voice fallback keeps the full text and supports cancellation', async () => {
  const h = harness();
  h.speak('Hello. Read the whole reply.', 'system');
  const utterance = h.utterances[0];
  assert.equal(utterance.text, 'Hello. Read the whole reply.');
  assert.equal(utterance.rate, 1.04 * 1.1);
  h.stopNearVoice();
  utterance.onend();
  assert.equal(h.callbacks.end, 0);
});

test('stream starts synthesizing a long opening sentence before the answer finishes', async () => {
  const h = harness();
  const stream = h.startNearSpeechStream();
  stream.push('I hear how difficult this has been for you and we can take a moment together to think about one small step that might help you feel a little more settled ');
  await flush();
  assert.equal(h.requests.length, 1, 'Speech must start without waiting for sentence punctuation or finish()');
  assert.ok(h.requests[0].text.length <= 160, 'Keep the first synthesis request small');
  h.stopNearVoice();
});

test('stream preserves words and spacing across tokens and speech chunks', async () => {
  const h = harness();
  const stream = h.startNearSpeechStream();
  const text = 'Hey, brother! Good to hear from you. ' + 'We can take a little time together and think about the next step '.repeat(14) + 'How is your day going?';
  for (let index = 0; index < text.length; index += 3) stream.push(text.slice(index, index + 3));
  stream.finish();
  for (let index = 0; index < 100 && stream.status !== 'finished'; index++) {
    await flush();
    for (const request of h.requests) request.resolve(encodedAudio);
    await flush();
    h.audio.at(-1)?.end();
  }
  assert.equal(stream.status, 'finished');
  assert.equal(h.requests.map((request) => request.text).join(' '), text.trim());
  assert.ok(h.requests.every((request) => request.text.length <= 300), 'Long sentences must not become large synthesis requests');
});

test('a short completed sentence starts before the server closes its stream', async () => {
  const h = harness();
  const stream = h.startNearSpeechStream();
  stream.push('Hello, I am here with you.');
  h.advanceTimers();
  await flush();
  assert.equal(h.requests.length, 1, 'Do not wait for response.completed after text is already available');
  assert.equal(h.requests[0].text, 'Hello, I am here with you.');
  h.stopNearVoice();
});

test('slow incoming text starts at a whole word and preserves the unfinished word', async () => {
  const h = harness();
  const stream = h.startNearSpeechStream();
  stream.push('We can take a moment together and find some pea');
  h.advanceTimers();
  await flush();
  assert.equal(h.requests.length, 1);
  assert.equal(h.requests[0].text, 'We can take a moment together and find some');
  stream.push('ce today.');
  stream.finish();
  h.requests[0].resolve(encodedAudio);
  await flush();
  assert.equal(h.requests[1].text, 'peace today.');
  h.stopNearVoice();
});

test('stopping a pending opening phrase clears its timer and never starts late audio', async () => {
  const h = harness();
  const stream = h.startNearSpeechStream();
  stream.push('Hello, I am here with you.');
  h.stopNearVoice();
  h.advanceTimers();
  await flush();
  assert.equal(h.requests.length, 0);
  assert.equal(h.timers.size, 0);
});
