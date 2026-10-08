// @ts-check
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const extensionSource = fs.readFileSync(path.join(root, 'src', 'extension.js'), 'utf8');

test('has no runtime dependencies', () => {
  assert.equal(pkg.dependencies, undefined);
});

test('activates lazily after start-up and runs on the local machine first', () => {
  assert.deepEqual(pkg.activationEvents, ['onStartupFinished']);
  assert.equal(pkg.extensionKind[0], 'ui');
  assert.equal(pkg.main, './src/extension.js');
  assert.ok(fs.existsSync(path.join(root, pkg.main)));
});

test('every contributed command is registered, and vice versa', () => {
  const contributed = pkg.contributes.commands.map((/** @type {{command: string}} */ c) => c.command).sort();
  const registered = [...extensionSource.matchAll(/registerCommand\(`\$\{SECTION\}\.(\w+)`/g)].map(m => `agentKeepAwake.${m[1]}`);
  for (const id of contributed) {
    assert.ok(registered.includes(id), `${id} is contributed but not registered`);
  }
  const internalOnly = registered.filter(id => !contributed.includes(id));
  assert.deepEqual(internalOnly, ['agentKeepAwake.openSettings'], 'only the tooltip helper command is internal');
});

test('every setting read by the code is declared with a default', () => {
  const declared = pkg.contributes.configuration.properties;
  const used = [...extensionSource.matchAll(/c\.get\('(\w+)'/g)].map(m => m[1]);
  assert.ok(used.length >= 5);
  for (const key of used) {
    const decl = declared[`agentKeepAwake.${key}`];
    assert.ok(decl, `agentKeepAwake.${key} is not declared`);
    assert.notEqual(decl.default, undefined, `agentKeepAwake.${key} has no default`);
  }
});

test('defaults are the no-fuss ones', () => {
  const p = pkg.contributes.configuration.properties;
  assert.equal(p['agentKeepAwake.enabled'].default, true);
  assert.equal(p['agentKeepAwake.mode'].default, 'always');
  assert.equal(p['agentKeepAwake.keepDisplayOn'].default, false);
  assert.equal(p['agentKeepAwake.activityTimeoutMinutes'].default, 30);
});

test('the packaged extension excludes tests, docs and tooling', () => {
  const ignore = fs.readFileSync(path.join(root, '.vscodeignore'), 'utf8').split(/\r?\n/);
  for (const entry of ['test/**', 'docs/**', 'node_modules/**', '.github/**']) {
    assert.ok(ignore.includes(entry), `.vscodeignore should contain ${entry}`);
  }
});
