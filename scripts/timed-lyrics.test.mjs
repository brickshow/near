import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const exports = {};
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/timedLyrics.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, { exports });
test('enhanced lyrics retain exact word timestamps and change lines with playback', () => {
  const lines = exports.parseLyrics('[00:01.00]<00:01.00>One <00:01.75>two\n[00:03.00]<00:03.00>Three');
  assert.equal(exports.lyricAt(lines, 0), undefined);
  assert.equal(exports.lyricAt(lines, 1.8).words[1].time, 1.75);
  assert.equal(exports.lyricAt(lines, 1.8).text, 'One two');
  assert.equal(exports.lyricAt(lines, 3).text, 'Three');
  assert.equal(exports.lyricAt(lines, 1.2).text, 'One two', 'seeking backwards restores the earlier line');
});
test('line timing never fabricates word timing; offsets and repeated lines are supported', () => {
  const lines = exports.parseLyrics('[offset:-500]\n[00:02.00][00:05.00]Repeated line');
  assert.equal(lines.length, 2);
  assert.equal(lines[0].time, 1.5);
  assert.equal(lines[1].time, 4.5);
  assert.equal(lines[0].words.length, 0);
  assert.equal(exports.parseLyrics('Untimed words\n[ar:Artist]').length, 0);
});
