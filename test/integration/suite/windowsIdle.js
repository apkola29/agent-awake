// @ts-check
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const vscode = require('vscode');
const { nodeWorker, identities } = require('../native');

const ID = 'apkola29.agent-keep-awake';
const ROOT = path.resolve(__dirname, '..', '..', '..');
const sleep = (/** @type {number} */ ms) => new Promise(resolve => setTimeout(resolve, ms));

async function nativeState() {
  const state = await nodeWorker('console.log(JSON.stringify(require(process.argv[1]).probe()))',
    path.join(ROOT, 'test', 'os', 'probe.js'), null);
  assert.ok(state && typeof state === 'object' && 'system' in state && 'display' in state && 'raw' in state);
  assert.equal(typeof state.system, 'boolean');
  assert.equal(typeof state.display, 'boolean');
  return state;
}

/** @param {string} root @param {string} version @returns {string | undefined} */
function activationLog(root, version) {
  for (const session of fs.readdirSync(root, { withFileTypes: true }).filter(entry => entry.isDirectory())) {
    const sessionPath = path.join(root, session.name);
    for (const window of fs.readdirSync(sessionPath, { withFileTypes: true }).filter(entry => entry.isDirectory() && entry.name.startsWith('window'))) {
      const windowPath = path.join(sessionPath, window.name);
      for (const host of fs.readdirSync(windowPath, { withFileTypes: true }).filter(entry => entry.isDirectory() && entry.name.startsWith('exthost'))) {
        const filename = path.join(windowPath, host.name, ID, 'Agent Awake.log');
        if (fs.existsSync(filename)) {
          const text = fs.readFileSync(filename, 'utf8');
          if (text.includes(`Agent Awake ${version} loaded.`) &&
              text.includes('is holding the power request (display kept on)')) return filename;
        }
      }
    }
  }
  return undefined;
}

/** @param {string} executable @param {string[]} args */
function observe(executable, args) {
  return new Promise((resolve, reject) => {
    execFile(executable, args, { windowsHide: true, encoding: 'utf8', timeout: 340_000, maxBuffer: 64 * 1024 },
      (error, stdout, stderr) => {
        if (stdout) console.log(stdout.trim());
        if (error) {
          reject(new Error(`Read-only hardware observation failed: ${stderr.trim() || error.message}`));
        } else {
          resolve(stdout);
        }
      });
  });
}

async function run() {
  assert.equal(process.platform, 'win32');
  const workspace = process.env.AKA_TEST_WORKSPACE;
  const logs = process.env.AKA_TEST_LOGS;
  const pwsh = process.env.AKA_TEST_PWSH;
  assert.ok(workspace && logs && pwsh, 'dedicated runner context is required');
  console.log('CONTROLLED-EDITOR HARDWARE COMPONENT CHECK; NOT THE AFFECTED WORK WINDOW, NATIVE AUTO OR PUBLICATION APPROVAL.');
  /** @type {vscode.Extension<ReturnType<typeof import('../../../src/extension').activate>> | undefined} */
  const extension = vscode.extensions.getExtension(ID);
  assert.ok(extension, 'actual candidate extension is loaded');
  const api = await extension.activate();
  assert.equal(api.getState().version, extension.packageJSON.version);
  assert.equal(api.getState().mode, 'off');
  const baseline = await nativeState();
  if (baseline.system || baseline.display) {
    const reason = 'INCONCLUSIVE: ambient power requests prevent a controlled hardware component check.';
    fs.writeFileSync(path.join(workspace, 'inconclusive.json'), JSON.stringify({ reason, baseline }));
    throw new Error(reason);
  }
  let leftForShutdown = false;
  try {
    await vscode.workspace.getConfiguration('agentKeepAwake').update('durationHours', 0, vscode.ConfigurationTarget.Global);
    const control = api.getState().statusCommand;
    assert.ok(typeof control === 'string' && control === 'agentKeepAwake.toggleSession', 'actual cup must expose the direct toggle command');
    await vscode.commands.executeCommand(control);
    const held = api.getState();
    assert.equal(held.version, extension.packageJSON.version);
    assert.equal(held.mode, 'manual');
    assert.equal(held.confirmed, true);
    assert.equal(held.durationMs, 0);
    assert.equal(held.expiresAt, 0);
    assert.equal(held.pids.length, 1);
    const marks = await identities(held.pids);
    assert.equal(marks.length, 1);
    fs.writeFileSync(path.join(workspace, 'owned-helpers.json'), JSON.stringify(marks));
    const request = await nativeState();
    assert.equal(request.system, true);
    assert.equal(request.display, true);
    const deadline = Date.now() + 15_000;
    let log;
    while (!log && Date.now() < deadline) {
      log = activationLog(logs, held.version);
      if (!log) await sleep(250);
    }
    assert.ok(log, 'own loaded-version/actual-helper log must be present');
    console.log(`Actual candidate ${held.version}; extension-host PID=${process.pid}; helper=${held.pids[0]}; native=${request.raw}.`);
    try {
      await observe(pwsh, ['-NoProfile', '-File', path.join(ROOT, 'test', 'os', 'observe-window-windows.ps1'),
        '-ExtensionLog', log, '-ProbePath', path.join(ROOT, 'test', 'os', 'probe.js'),
        '-CodeLogsRoot', logs, '-ExpectedVersion', held.version, '-Seconds', '240']);
    } catch (error) {
      if (error instanceof Error && error.message.includes('INCONCLUSIVE:')) {
        fs.writeFileSync(path.join(workspace, 'inconclusive.json'), JSON.stringify({
          reason: 'INCONCLUSIVE: controlled-editor idle/AC/ownership prerequisites were not met; see observer output. No hardware acceptance is recorded.',
          baseline
        }));
      }
      throw error;
    }
    const after = api.getState();
    assert.equal(after.confirmed, true);
    assert.deepEqual(after.pids, held.pids);
    assert.equal(after.expiresAt, 0);
    fs.writeFileSync(path.join(workspace, 'shutdown-check.json'), JSON.stringify({
      pids: after.pids, baseline, platform: process.platform,
      mode: after.mode, state: after.state, durationMs: after.durationMs, expiresAt: after.expiresAt
    }));
    leftForShutdown = true;
    console.log('PASS controlled-editor native idle component; leaving its actual until-off lease for real-editor-close cleanup.');
    console.log('BLOCKED affected-work-window acceptance and automatic native chat lifecycle; not inferred from this component check.');
  } finally {
    if (!leftForShutdown) await vscode.commands.executeCommand('agentKeepAwake.turnOff');
  }
}

module.exports = { run };
