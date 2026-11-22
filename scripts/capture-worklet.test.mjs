import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

function capture() {
  const messages = [];
  let Processor;
  runInNewContext(readFileSync(new URL('../public/pcm-capture-worklet.js', import.meta.url), 'utf8'), {
    AudioWorkletProcessor: class { constructor() { this.port = { postMessage: (message) => messages.push(message) }; } },
    registerProcessor: (_name, implementation) => { Processor = implementation; },
    Float32Array,
  });
  const processor = new Processor();
  return {
    messages,
    audio: () => messages.filter((message) => message.type === 'audio'),
    feed: (samples) => processor.process([[samples]], []),
    send: (data) => processor.port.onmessage({ data }),
  };
}

test('stopping at a window boundary does not transcribe the same overlap twice', () => {
  const h = capture();
  h.feed(new Float32Array(32_000).fill(0.25));
  h.send('flush');
  assert.equal(h.audio().length, 1, 'The 500 ms overlap is already transcribed; do not add another Whisper request');
  assert.equal(h.messages.at(-1).type, 'flushed');
});

test('stopping still sends new speech after the last complete window', () => {
  const h = capture();
  h.feed(new Float32Array(32_000).fill(0.25));
  h.feed(new Float32Array(1_600).fill(0.5));
  h.send('flush');
  assert.equal(h.audio().length, 2);
  assert.equal(h.audio()[1].samples.length, 9_600);
  assert.equal(h.audio()[1].samples.at(-1), 0.5);
});

test('short recordings flush all captured speech', () => {
  const h = capture();
  h.feed(new Float32Array(1_600).fill(0.5));
  h.send('flush');
  assert.equal(h.audio().length, 1);
  assert.equal(h.audio()[0].samples.length, 1_600);
});

for (const command of ['flush', 'cancel']) {
  test(`${command} stops further capture while the main thread drains transcription`, () => {
    const h = capture();
    h.feed(new Float32Array(1_600));
    h.send(command);
    const count = h.audio().length;
    h.feed(new Float32Array(32_000));
    assert.equal(h.audio().length, count);
  });
}
