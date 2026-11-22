import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('notes can be created, edited, listed and deleted without changing calendar events', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(readFileSync(new URL('../src-tauri/migrations/0001_initial.sql', import.meta.url), 'utf8'));
  database.exec("INSERT INTO events(title, starts_at) VALUES('Church service', '2030-06-10T09:00:00Z')");
  const bindings = values => Object.fromEntries(values.map((value, index) => [`$${index + 1}`, value]));
  const db = {
    select: async (sql, values = []) => database.prepare(sql).all(bindings(values)),
    execute: async (sql, values = []) => {
      const result = database.prepare(sql).run(bindings(values));
      return { lastInsertId: Number(result.lastInsertRowid) };
    },
  };
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL('../src/lib/notes.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(source, { exports, require: () => ({ getDatabase: async () => db }) });
  const id = await exports.saveNote('My note', 'First line\nSecond line');
  assert.equal((await exports.listNotes())[0].content, 'First line\nSecond line');
  await exports.saveNote('Updated note', 'Updated text', id);
  assert.equal((await exports.listNotes()).length, 1);
  assert.equal((await exports.listNotes())[0].title, 'Updated note');
  await exports.deleteNote(id);
  assert.equal((await exports.listNotes()).length, 0);
  assert.equal(database.prepare('SELECT title FROM events').get().title, 'Church service');
  await assert.rejects(exports.saveNote('   ', 'text'), /title/);
  database.close();
});
