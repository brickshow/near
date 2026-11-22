import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(fs.readFileSync(new URL("../src/lib/bibleReading.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
function harness() {
  const exports = {};
  vm.runInNewContext(source, { exports, require: () => ({}) });
  const calls = [], states = [], errors = [];
  const reader = exports.createBibleReading(v => states.push(v), e => errors.push(e), (text, voice, options) => {
    const handle = {};
    calls.push({ text, options, handle });
    return handle;
  }, () => {});
  return { reader, calls, states, errors };
}
const verses = [{ number: 1, text: "In the beginning God created the heavens and the earth." }, { number: 2, text: "And the earth was waste and void;" }];
test("reads original verses in order at the selected speed and finishes", () => {
  const h = harness(); h.reader.read(verses, 0, 0.75);
  assert.equal(h.calls[0].text, verses[0].text);
  assert.equal(h.calls[0].options.rate, 0.75);
  h.calls[0].handle.onend();
  assert.equal(h.calls[1].text, verses[1].text);
  h.calls[1].handle.onend();
  assert.equal(h.states.at(-1), null);
});
test("stop and replacement invalidate late callbacks", () => {
  const h = harness(); h.reader.read(verses);
  const stale = h.calls[0].handle;
  h.reader.stop(); stale.onend();
  assert.equal(h.calls.length, 1);
  h.reader.read(verses, 1);
  stale.onerror("stale failure"); stale.onend();
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].text, verses[1].text);
  assert.deepEqual(h.errors, []);
});
test("playback failure ends reading and reports an error", () => {
  const h = harness(); h.reader.read(verses);
  h.calls[0].handle.onerror("Voice unavailable");
  h.calls[0].handle.onend();
  assert.equal(h.calls.length, 1);
  assert.equal(h.states.at(-1), null);
  assert.deepEqual(h.errors, ["Voice unavailable"]);
});

test("only finished verses update progress, never canceled or stale speech", () => {
  const h = harness(), completed = [];
  h.reader.read(verses, 0, 1, verse => completed.push(verse));
  assert.deepEqual(completed, []);
  h.calls[0].handle.onend();
  assert.deepEqual(completed, [1]);
  h.reader.stop();
  h.calls[1].handle.onend();
  assert.deepEqual(completed, [1]);
  h.reader.read(verses, 1, 1, verse => completed.push(verse));
  h.calls[2].handle.onend();
  assert.deepEqual(completed, [1, 2]);
});

const progressExports = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL("../src/lib/bibleProgress.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: progressExports });
test("completed reading position survives reload and storage failures are handled", () => {
  let value = null;
  const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
  const progress = { book: 43, chapter: 3, verse: 16 };
  assert.equal(progressExports.saveBibleProgress(storage, progress), true);
  assert.equal(JSON.stringify(progressExports.loadBibleProgress(storage)), JSON.stringify(progress));
  for (const invalid of ['broken', 'null', '{"book":67,"chapter":1,"verse":1}', '{"book":1,"chapter":0,"verse":1}']) {
    value = invalid;
    assert.equal(progressExports.loadBibleProgress(storage), null);
  }
  assert.equal(progressExports.saveBibleProgress({ setItem() { throw Error("Full"); } }, progress), false);
});
