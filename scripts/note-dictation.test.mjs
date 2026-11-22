import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const exports = {};
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/noteDictation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports, require: () => ({}) });
function setup(overrides = {}) {
  const texts = [], phases = [], errors = [];
  let update, fail, canceled = 0;
  const capture = { stop: async () => 'Complete sentence.', cancel: () => { canceled++; } };
  const engine = { modelStatus: async () => ({ installed: true }), prepare: async () => {}, start: async (onText, onError) => { update = onText; fail = onError; return capture; }, ...overrides };
  const controller = exports.createNoteDictation(text => texts.push(text), phase => phases.push(phase), error => errors.push(error), engine);
  return { controller, texts, phases, errors, capture, update: text => update(text), fail: error => fail(error), canceled: () => canceled };
}
test('dictation preserves typed text and replaces cumulative partials without duplication', async () => {
  const h = setup();
  await h.controller.start('My typed note.');
  h.update('Complete'); h.update('Complete sentence.');
  await h.controller.stop();
  assert.equal(h.texts.at(-1), 'My typed note.\nComplete sentence.');
  assert.equal(h.phases.at(-1), 'idle');
  await h.controller.start(h.texts.at(-1));
  h.update('Another sentence.');
  assert.equal(h.texts.at(-1), 'My typed note.\nComplete sentence.\nAnother sentence.');
  h.controller.cancel();
});
test('canceling while microphone starts releases late capture and ignores stale text', async () => {
  let resolveCapture, update;
  const h = setup({ start: (callback) => { update = callback; return new Promise(resolve => { resolveCapture = resolve; }); } });
  const started = h.controller.start('Original');
  await new Promise(setImmediate);
  h.controller.cancel();
  resolveCapture(h.capture);
  await started;
  update('Late words');
  assert.equal(h.canceled(), 1);
  assert.equal(h.texts.length, 0);
  assert.equal(h.phases.at(-1), 'idle');
});
test('capture failure stops microphone and leaves recognized text available', async () => {
  const h = setup(); await h.controller.start('');
  h.update('Keep this'); h.fail(Error('Microphone disconnected'));
  h.update('Late words');
  assert.equal(h.texts.at(-1), 'Keep this');
  assert.equal(h.canceled(), 1);
  assert.equal(h.errors.at(-1), 'Microphone disconnected');
});
test('missing model returns useful setup guidance without requesting microphone', async () => {
  const h = setup({ modelStatus: async () => ({ installed: false }), start: () => assert.fail('No capture without a model') });
  await h.controller.start('');
  assert.match(h.errors.at(-1), /download the speech model/);
  assert.equal(h.phases.at(-1), 'idle');
});

test('music captions do not overwrite notes and are reported as non-speech', async () => {
  for (const caption of ['MUSIC Playing', '[music playing]', '(Music)', '♪']) {
    const h = setup(); h.capture.stop = async () => caption;
    await h.controller.start('Keep my existing note.');
    h.update(caption); await h.controller.stop();
    assert.equal(h.texts.length, 0, `must not insert ${caption}`);
    assert.match(h.errors.at(-1), /music|speech/i);
  }
});
test('speech about music stays intact while bracketed audio captions are removed', async () => {
  const h = setup();
  h.capture.stop = async () => '[Music] I heard music playing at church.';
  await h.controller.start(''); h.update('[Music] I heard music playing at church.'); await h.controller.stop();
  assert.equal(h.texts.at(-1), 'I heard music playing at church.');
});

test('dictation uses the selected microphone instead of silently choosing another input', async () => {
  let options;
  const h = setup({ start: async (_update, _error, value) => { options = value; return { stop: async () => '', cancel() {} }; } });
  await h.controller.start('', 'headset-microphone');
  assert.equal(options.deviceId, 'headset-microphone');
  h.controller.cancel();
});
