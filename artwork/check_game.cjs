const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const elements = {};
const calls = [];
let failImages = false;
class Image {
  set src(value) {
    assert(fs.existsSync(path.join(root, value)), `Missing asset: ${value}`);
    queueMicrotask(() => failImages ? this.onerror() : this.onload());
  }
}
const drawing = { clearRect() {}, drawImage(...args) { calls.push(args); } };
const sandbox = {
  Image,
  document: { getElementById: id => elements[id] ??= id === 'game'
    ? { getContext: () => drawing, addEventListener() {} } : {} },
  window: { addEventListener() {} },
  requestAnimationFrame() {},
  HTMLButtonElement: class {},
};
vm.createContext(sandbox);
const run = code => vm.runInContext(code, sandbox);
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
run(html.split('<script>')[1].split('</script>')[0]);
(async () => {
  await new Promise(setImmediate);
  assert.equal(run('artLoaded'), true);
  assert.equal(run('Object.keys(art).length'), 10);
  run('reset(); launch(); update(0.016); draw();');
  assert.equal(calls.length, 43, '40 bricks, backdrop, paddle and ball');
  run('togglePause()');
  assert.equal(run('state'), 'paused');
  run('togglePause(); ball.y=600; update(0.016)');
  assert.equal(run('lives'), 2);
  assert.equal(run('state'), 'ready');
  run('reset(); launch(); bricks.forEach(b=>b.alive=false); update(0.016)');
  assert.equal(run('level'), 2);
  failImages = true;
  await run('loadArt()');
  assert.equal(run('state'), 'asset-error');
  assert.equal(elements.action.disabled, false);
  failImages = false;
  run('activate()');
  await new Promise(setImmediate);
  assert.equal(run('artLoaded'), true);
  assert.equal(run('state'), 'intro');
  console.log('PASS: 10 asset paths, bitmap-only renderer, loading, failure/retry, pause, life loss and progression.');
})().catch(error => { console.error(error); process.exitCode = 1; });
