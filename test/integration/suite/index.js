// @ts-check
'use strict';

/**
 * End-to-end tests that run inside a real VS Code extension host. They drive the extension the
 * way a user would (commands and settings) and check the effect at the operating-system level.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { probe, isAlive } = require('../../os/probe');

const SECTION = 'agentKeepAwake';
const G = vscode.ConfigurationTarget.Global;

/** @type {{ name: string, fn: () => Promise<void> }[]} */
const tests = [];
/** @param {string} name @param {() => Promise<void>} fn */
const test = (name, fn) => tests.push({ name, fn });

/** @param {number} ms */
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * @param {() => boolean} predicate
 * @param {number} timeoutMs
 * @param {string} what
 */
async function waitFor(predicate, timeoutMs, what) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (predicate()) {
      return;
    }
    await sleep(100);
  }
  if (!predicate()) {
    throw new Error(`Timed out after ${timeoutMs}ms waiting for: ${what}. State: ${JSON.stringify(api.getState())}`);
  }
}

/** @type {any} */
let api;
const state = () => api.getState();
const config = () => vscode.workspace.getConfiguration(SECTION);
/** @param {string} key @param {unknown} value */
const set = (key, value) => config().update(key, value, G);
/** What the OS reports while this extension holds nothing (other programs may hold requests too). */
let baseline = { system: false, display: false, raw: 'not measured' };

/** @param {string} expected */
const waitBackend = (expected, timeoutMs = 120_000) => waitFor(() => state().backendState === expected, timeoutMs, `backend ${expected}`);

test('activates after start-up and exposes its state', async () => {
  const ext = vscode.extensions.getExtension('apkola29.agent-keep-awake');
  assert.ok(ext, 'extension is installed');
  api = await ext.activate();
  assert.ok(ext.isActive);
  assert.equal(typeof api.getState, 'function');
  const commands = await vscode.commands.getCommands(true);
  for (const id of ['toggle', 'enable', 'disable', 'showStatus', 'showLog']) {
    assert.ok(commands.includes(`${SECTION}.${id}`), `${id} registered`);
  }
  // Measure the OS baseline with this extension switched off, then restore the default.
  await waitFor(() => state().backendState !== 'starting', 120_000, 'initial start-up');
  const pids = state().pids;
  await set('enabled', false);
  await waitBackend('off', 10_000);
  await waitFor(() => pids.every((/** @type {number} */ p) => !isAlive(p)), 10_000, 'helper exit');
  await sleep(300);
  baseline = probe();
  console.log(`    OS baseline without this extension: ${baseline.raw}`);
  await set('enabled', undefined);
});

test('out of the box it keeps the machine awake (mode "always")', async () => {
  await waitBackend('on');
  const s = state();
  assert.equal(s.enabled, true);
  assert.equal(s.mode, 'always');
  assert.equal(s.keepDisplayOn, false);
  assert.equal(s.statusText, '$(coffee)');
  assert.ok(s.pids.length >= 1 && s.pids.every((/** @type {number} */ p) => isAlive(p)), 'helper process alive');
  const os = probe(s.pids);
  assert.ok(os.system, `OS reports the sleep block: ${os.raw}`);
});

test('"Toggle" turns it off: setting saved, helper gone, OS request released', async () => {
  const pids = state().pids;
  await vscode.commands.executeCommand(`${SECTION}.toggle`);
  await waitBackend('off', 10_000);
  assert.equal(config().get('enabled'), false);
  assert.equal(state().statusText, '$(circle-slash)');
  await waitFor(() => pids.every((/** @type {number} */ p) => !isAlive(p)), 10_000, 'helper exit');
  if (!baseline.system) {
    await sleep(300);
    assert.ok(!probe(pids).system, `OS released the block: ${probe(pids).raw}`);
  }
});

test('"Turn On" turns it back on', async () => {
  await vscode.commands.executeCommand(`${SECTION}.enable`);
  await waitBackend('on');
  assert.equal(config().get('enabled'), true);
  assert.ok(probe(state().pids).system);
});

test('"Turn Off" and toggling twice round-trip correctly', async () => {
  await vscode.commands.executeCommand(`${SECTION}.disable`);
  await waitBackend('off', 10_000);
  await vscode.commands.executeCommand(`${SECTION}.toggle`);
  await waitBackend('on');
  await vscode.commands.executeCommand(`${SECTION}.toggle`);
  await waitBackend('off', 10_000);
  await vscode.commands.executeCommand(`${SECTION}.toggle`);
  await waitBackend('on');
});

test('keepDisplayOn also blocks display sleep, and turning it off restores the default', async () => {
  const before = state().pids;
  await set('keepDisplayOn', true);
  await waitFor(() => state().backendState === 'on' && state().pids.length > 0 && state().pids.every((/** @type {number} */ p) => !before.includes(p)), 120_000, 'restart with display flag');
  const os = probe(state().pids);
  assert.ok(os.system && os.display, `display + system blocked: ${os.raw}`);
  await set('keepDisplayOn', undefined);
  await waitFor(() => state().keepDisplayOn === false && state().backendState === 'on', 120_000, 'restart without display flag');
  if (!baseline.display) {
    await sleep(500);
    assert.ok(!probe(state().pids).display, 'display no longer forced on');
  }
});

test('activity mode: stays awake briefly after switching, then lets the machine sleep', async () => {
  api.setActivityTimeoutOverrideMs(3_000);
  await set('mode', 'activity');
  await waitFor(() => state().mode === 'activity', 5_000, 'mode applied');
  await waitBackend('off', 20_000);
  const s = state();
  assert.equal(s.activityActive, false);
  assert.equal(s.statusText, '$(coffee)', 'dimmed cup while watching');
});

test('activity mode: an edit (like an agent writing code) keeps it awake until the timeout', async () => {
  const doc = await vscode.workspace.openTextDocument({ content: 'hello' });
  const edit = new vscode.WorkspaceEdit();
  edit.insert(doc.uri, new vscode.Position(0, 0), 'agent was here\n');
  assert.ok(await vscode.workspace.applyEdit(edit));
  await waitBackend('on');
  assert.equal(state().activityActive, true);
  assert.ok(probe(state().pids).system);
  await waitBackend('off', 30_000);
});

test('activity mode: files changed on disk (e.g. by a CLI agent) count as activity', async () => {
  const workspace = /** @type {string} */ (process.env.AKA_TEST_WORKSPACE);
  assert.ok(workspace && fs.existsSync(workspace));
  await sleep(1_000);
  fs.writeFileSync(path.join(workspace, `agent-output-${Date.now()}.txt`), 'written outside VS Code\n');
  await waitBackend('on', 60_000);
  await waitBackend('off', 30_000);
});

test('activity mode: changes inside .git do not count as activity', async () => {
  const workspace = /** @type {string} */ (process.env.AKA_TEST_WORKSPACE);
  const gitDir = path.join(workspace, '.git');
  fs.mkdirSync(gitDir, { recursive: true });
  await sleep(1_500);
  for (let i = 0; i < 3; i++) {
    fs.writeFileSync(path.join(gitDir, 'FETCH_HEAD'), `fetch ${i}\n`);
    await sleep(300);
  }
  await sleep(2_000);
  assert.equal(state().backendState, 'off', 'git housekeeping must not keep the machine awake');
});

/**
 * Resolves with the first event matching `filter`, or rejects after `timeoutMs`.
 * @template T
 * @param {vscode.Event<T>} event
 * @param {(e: T) => boolean} filter
 * @param {number} timeoutMs
 * @param {string} what
 * @returns {Promise<T>}
 */
function nextEvent(event, filter, timeoutMs, what) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { sub.dispose(); reject(new Error(`Timed out after ${timeoutMs}ms waiting for ${what}`)); }, timeoutMs);
    const sub = event(e => {
      if (filter(e)) {
        clearTimeout(timer);
        sub.dispose();
        resolve(e);
      }
    });
  });
}

test('activity mode: a long-running task keeps it awake until the task finishes', async () => {
  const name = 'aka sleepy task';
  const task = new vscode.Task(
    { type: 'agentKeepAwakeTest' },
    vscode.TaskScope.Workspace,
    name,
    'agent-keep-awake-tests',
    new vscode.CustomExecution(async () => {
      const write = new vscode.EventEmitter();
      const close = new vscode.EventEmitter();
      return {
        onDidWrite: write.event,
        onDidClose: close.event,
        open: () => {
          write.fire('pretending to run a long build...\r\n');
          setTimeout(() => close.fire(0), 7_000);
        },
        close: () => { /* nothing to clean up */ }
      };
    })
  );
  const started = nextEvent(vscode.tasks.onDidStartTask, e => e.execution.task.name === name, 30_000, 'task start');
  const ended = nextEvent(vscode.tasks.onDidEndTask, e => e.execution.task.name === name, 60_000, 'task end');
  await vscode.tasks.executeTask(task);
  await started;
  await waitBackend('on', 30_000);
  await sleep(5_000); // longer than the 3 s timeout
  assert.equal(state().backendState, 'on', 'still awake while the task runs');
  assert.ok(state().busyCount >= 1);
  await ended;
  await waitBackend('off', 30_000);
});

test('activity mode: a running terminal command keeps it awake (needs shell integration)', async () => {
  const terminal = vscode.window.createTerminal({ name: 'aka-test' });
  terminal.show();
  /** @type {vscode.TerminalShellIntegration | undefined} */
  let integration = terminal.shellIntegration;
  if (!integration) {
    integration = await nextEvent(vscode.window.onDidChangeTerminalShellIntegration, e => e.terminal === terminal, 20_000, 'shell integration')
      .then(e => e.shellIntegration, () => undefined);
  }
  if (!integration) {
    console.log('    (skipped: shell integration not available in this environment)');
    terminal.dispose();
    return;
  }
  await waitBackend('off', 30_000);
  const command = process.platform === 'win32' ? 'Start-Sleep -Seconds 7' : 'sleep 7';
  const ended = nextEvent(vscode.window.onDidEndTerminalShellExecution, e => e.terminal === terminal, 60_000, 'command end');
  integration.executeCommand(command);
  await waitBackend('on', 30_000);
  await sleep(5_000);
  assert.equal(state().backendState, 'on', 'still awake while the command runs');
  await ended;
  await waitBackend('off', 30_000);
  terminal.dispose();
});

test('back to "always" mode holds again immediately', async () => {
  api.setActivityTimeoutOverrideMs(undefined);
  await set('mode', undefined);
  await waitBackend('on');
  assert.equal(state().mode, 'always');
  assert.equal(state().activityActive, false);
});

test('"Show Status" and "Show Log" commands run without errors', async () => {
  await vscode.commands.executeCommand(`${SECTION}.showLog`);
  // showStatus waits for the user to pick a button, so only make sure it does not fail.
  const outcome = await Promise.race([
    Promise.resolve(vscode.commands.executeCommand(`${SECTION}.showStatus`)).then(() => 'done', (/** @type {Error} */ e) => `failed: ${e.message}`),
    sleep(1_500).then(() => 'waiting for user')
  ]);
  assert.notEqual(outcome.slice(0, 6), 'failed', outcome);
  await vscode.commands.executeCommand('notifications.clearAll');
});

test('hiding the status bar item keeps keep-awake working', async () => {
  await set('showStatusBarItem', false);
  await sleep(500);
  assert.equal(state().backendState, 'on');
  await set('showStatusBarItem', undefined);
});

async function run() {
  /** @type {string[]} */
  const failures = [];
  console.log(`\nAgent Keep-Awake integration tests (VS Code ${vscode.version}, ${process.platform}/${process.arch})\n`);
  for (const t of tests) {
    const start = Date.now();
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let timer;
    try {
      await Promise.race([
        t.fn(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('test timed out after 180s')), 180_000); })
      ]);
      console.log(`  \u2714 ${t.name} (${Date.now() - start}ms)`);
    } catch (err) {
      failures.push(t.name);
      console.log(`  \u2716 ${t.name}\n      ${err instanceof Error ? err.stack || err.message : String(err)}`);
    } finally {
      clearTimeout(timer);
    }
  }
  for (const key of ['enabled', 'mode', 'keepDisplayOn', 'showStatusBarItem', 'activityTimeoutMinutes']) {
    await set(key, undefined);
  }
  console.log(`\n${tests.length - failures.length} passing, ${failures.length} failing\n`);
  if (failures.length) {
    throw new Error(`${failures.length} integration test(s) failed: ${failures.join('; ')}`);
  }
}

module.exports = { run };
