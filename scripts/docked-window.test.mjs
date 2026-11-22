import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function setup(existing = false) {
  const calls = [], created = [], exports = {};
  const panel = { label: 'near-notes' };
  for (const method of ['setDecorations','setShadow','setBackgroundColor','setResizable','setAlwaysOnTop','setSize','setPosition','show','setFocus']) panel[method] = async value => calls.push([method,value]);
  class WebviewWindow { constructor(label, options) { created.push({ label, options }); } once() {} }
  class Pair { constructor(a,b) { this.a=a; this.b=b; } }
  runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/dockedWindow.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports, require(name) {
    if (name.endsWith('/core')) return { isTauri: () => true };
    if (name.endsWith('/window')) return { currentMonitor: async () => ({ scaleFactor: 1, workArea: { position:{x:0,y:0}, size:{width:1920,height:1040} } }), LogicalSize: Pair, LogicalPosition: Pair };
    return { getAllWebviewWindows: async () => existing ? [panel] : [], WebviewWindow };
  } });
  return { ...exports, calls, created };
}
test('all docked panels use opaque backgrounds without native shadows', async () => {
  for (const kind of ['bible','notes','church']) {
    const h = setup(); await h.openDockedWindow(kind);
    const options = h.created[0].options;
    assert.equal(options.transparent, false);
    assert.equal(options.shadow, false);
    assert.equal(options.backgroundColor, '#08131d');
    assert.equal(options.x + options.width, 1920);
  }
});
test('reopening an existing docked panel clears its old native shadow', async () => {
  const h = setup(true); await h.openDockedWindow('notes');
  assert.ok(h.calls.some(([method,value]) => method === 'setShadow' && value === false));
  assert.ok(h.calls.some(([method,value]) => method === 'setBackgroundColor' && value === '#08131d'));
  assert.equal(h.created.length, 0);
});
