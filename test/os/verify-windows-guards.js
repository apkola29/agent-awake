// @ts-check
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { buildHelpers } = require('../../src/keepAwake');
const { windowsMouseJiggleScript } = require('../../src/windowsMouseJiggle');

/** @param {string} command @param {string[]} args @returns {Promise<string>} */
function closedInput(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, 20_000);
    child.stdout.on('data', chunk => { stdout = (stdout + chunk.toString()).slice(-512); });
    child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-2048); });
    child.stdin.on('error', error => {
      if (error && 'code' in error && error.code === 'EPIPE') return;
      clearTimeout(timer);
      child.kill();
      reject(error);
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => {
      clearTimeout(timer);
      if (timedOut) reject(new Error('Startup/EOF cleanup exceeded 20 seconds; the exact test child was terminated.'));
      else if (code !== 0) reject(new Error(`Helper initialization/EOF failed (code=${code}): ${stderr.trim()}`));
      else resolve(stdout);
    });
    child.stdin.end();
  });
}

async function main() {
  if (process.platform !== 'win32') throw new Error('This startup check requires Windows.');
  const { helpers, error } = buildHelpers({
    platform: process.platform, display: false, mouseJiggle: true,
    pid: process.pid, env: process.env, exists: fs.existsSync
  });
  assert.equal(error, undefined);
  assert.equal(helpers.length, 1);
  const helper = helpers[0];
  assert.equal(helper.retry, false);
  const policy = windowsMouseJiggleScript().match(/function Get-JiggleAction \{[\s\S]*?\r?\n\}/)?.[0];
  assert.ok(policy);
  const cases = [
    { unlocked: false, idle: 600, pressed: false, expected: 'stop' },
    { unlocked: true, idle: 29.999, pressed: false, expected: 'skip' },
    { unlocked: true, idle: 30, pressed: true, expected: 'skip' },
    { unlocked: true, idle: 30, pressed: false, expected: 'move' },
    { unlocked: true, idle: 300, pressed: false, expected: 'move' },
    { unlocked: true, idle: 0, pressed: false, expected: 'skip' },
    { unlocked: true, idle: 4294967, pressed: false, expected: 'skip' }
  ];
  const idlePolicy = fs.readFileSync(path.join(__dirname, 'observe-window-windows.ps1'), 'utf8')
    .match(/function Test-GenuineIdle \{[\s\S]*?\r?\n\}/)?.[0];
  assert.ok(idlePolicy);
  const idleCases = [
    { native: 239.999, quiet: 300, expected: false },
    { native: 300, quiet: 239.999, expected: false },
    { native: 240, quiet: 240, expected: true },
    { native: 0, quiet: 300, expected: false },
    { native: 4294967, quiet: 2, expected: false },
    { native: 300, quiet: 300, expected: true }
  ];
  const payload = Buffer.from(JSON.stringify({ mouse: cases, idle: idleCases })).toString('base64');
  const program = [
    "$ErrorActionPreference='Stop'", policy, idlePolicy,
    `$samples=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json`,
    '$mouse=@(foreach($sample in $samples.mouse){Get-JiggleAction -Unlocked $sample.unlocked -IdleSeconds $sample.idle -Pressed $sample.pressed})',
    '$idle=@(foreach($sample in $samples.idle){Test-GenuineIdle -NativeIdleSeconds $sample.native -ObservedQuietSeconds $sample.quiet -RequiredSeconds 240})',
    '@{mouse=$mouse;idle=$idle}|ConvertTo-Json -Compress'
  ].join('\n');
  const results = await closedInput(helper.command, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(program, 'utf16le').toString('base64')]);
  assert.deepEqual(JSON.parse(results), {
    mouse: cases.map(sample => sample.expected), idle: idleCases.map(sample => sample.expected)
  });
  console.log('PASS actual PowerShell idle predicate: both thresholds, exact240, 239.999 rejection and huge-age/short-quiet rejection.');
  console.log('PASS actual PowerShell pulse policy: locked, held-button, recent input, exact 30-second and invalid-age cases.');
  console.log('BOOTSTRAP/EOF ONLY: stdin is closed before helper initialization. The movement loop must not execute; this is not sleep-prevention UAT.');
  const output = await closedInput(helper.command, helper.args);
  assert.match(output, /^READY$/m);
  console.log('PASS actual Windows helper P/Invoke initialization, READY and EOF exit with no movement loop entered. No simulated input was sent.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
