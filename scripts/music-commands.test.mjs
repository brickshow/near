import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const exports = {};
runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/musicCommands.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
test('plays default worship music and resolves explicit song requests', async () => {
  const resolved = [], opened = [];
  const command = exports.createMusicCommands(async query => { resolved.push(query); return { url: 'https://www.youtube.com/watch?v=abcdefghijk&autoplay=1', matched: true }; }, async url => opened.push(url));
  await command('Play me a music.');
  await command('Play Amazing Grace');
  assert.deepEqual(resolved, ['uplifting worship music', 'Amazing Grace']);
  assert.equal(opened.length, 2);
  assert.equal(await command('Hello'), null);
});
test('matched song starts playback in the YouTube media session after opening its video', async () => {
  const started = [];
  const command = exports.createMusicCommands(
    async () => ({ url: 'https://www.youtube.com/watch?v=abcdefghijk&autoplay=1', matched: true, title: 'Amazing Grace Official Video' }),
    async () => {},
    async title => started.push(title),
  );
  await command('Play Amazing Grace');
  assert.deepEqual(started, ['Amazing Grace Official Video']);
});
test('Cebuano, direct titles, cancel and unrelated chat', async () => {
  const opened = [];
  const command = exports.createMusicCommands(async query => ({url: query, matched: true}), async url => opened.push(url));
  await command('Patukar og kanta');
  await command('ayaw na');
  assert.equal(await command('Hello'), null);
  await command('Play Memories');
  assert.deepEqual(opened, ['uplifting worship music', 'Memories']);
  assert.equal(await command('PlayStation is fun'), null);
});
test('fallback and failed browser launch never claim successful playback', async () => {
  const fallback = exports.createMusicCommands(async () => ({url:'https://www.youtube.com/results', matched:false}), async () => {});
  assert.match(await fallback('Play Amazing Grace'), /could not select/);
  const failure = exports.createMusicCommands(async () => { throw Error('offline'); }, async () => assert.fail('should not open'));
  assert.match(await failure('Play Amazing Grace'), /could not open/);
  assert.equal(await failure('Please help me pray'), null);
});
test('faith conversation and music recommendations go to chat', async () => {
  const resolved = [];
  const command = exports.createMusicCommands(async query => { resolved.push(query); throw Error('must not search'); }, async () => {});
  assert.equal(await command('Hello NEAR'), null);
  assert.equal(await command('How are you?'), null);
  assert.equal(await command('Recommend a worship song'), null);
  assert.equal(await command("I'm frustrated"), null);
  assert.deepEqual(resolved, []);
});

