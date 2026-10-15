// @ts-check
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { buildHelpers } = require('../../src/keepAwake');
const { windowsMouseJiggleScript } = require('../../src/windowsMouseJiggle');

/** @param {string} command @param {string[]} args @param {string} [input] @returns {Promise<string>} */
function closedInput(command, args, input = '') {
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
    child.stdout.on('data', chunk => {
      if (stdout.length > 16_384) return;
      stdout += chunk.toString();
      if (stdout.length > 16_384) {
        child.kill();
        reject(new Error('Windows guard checker output exceeded 16KB.'));
      }
    });
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
    child.stdin.end(input);
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
    { unlocked: true, idle: 4294967, pressed: false, expected: 'invalid' }
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
  const source = windowsMouseJiggleScript();
  const desktopFunction = source.match(/function Test-InteractiveDesktop \{[\s\S]*?\r?\n\}/)?.[0];
  const pulseFunction = source.match(/function Invoke-JigglePulse \{[\s\S]*?\r?\n\}/)?.[0];
  assert.ok(desktopFunction && pulseFunction);
  const allocationStart = source.indexOf('  $lastInput = [Runtime.InteropServices.Marshal]::AllocHGlobal(8)');
  const allocationEnd = source.indexOf('  if (-not (Test-InteractiveDesktop))');
  assert.ok(allocationStart >= 0 && allocationEnd > allocationStart);
  const allocation = source.slice(allocationStart, allocationEnd);
  const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'mouse-native-stub.ps1'), 'utf8');
  assert.doesNotMatch(fixture, /DllImport|DefinePInvoke|user32\.dll|Add-Type/i, 'the fixture must not bind to live input APIs');
  const defaults = {
    now: 60_000, last: 0, unlocked: true, session: 1, desktop: 'Default',
    heldKey: 0, inputQuery: true, desktopQuery: true, accepted: 2, canceled: false,
    expectedSends: 1, expectedCloses: 1, error: ''
  };
  const pulseCases = [
    { name: 'idle-pair' },
    { name: 'exact30', now: 30_000 },
    { name: 'recent', now: 29_999, expectedSends: 0 },
    { name: 'held-mouse', heldKey: 1, expectedSends: 0 },
    { name: 'held-control', heldKey: 17, expectedSends: 0 },
    { name: 'held-windows-key', heldKey: 92, expectedSends: 0 },
    { name: 'locked', unlocked: false, expectedSends: 0, expectedCloses: 0, error: 'desktop locked' },
    { name: 'other-session', session: 2, expectedSends: 0, expectedCloses: 0, error: 'session changed' },
    { name: 'secure-desktop', desktop: 'Winlogon', expectedSends: 0, error: 'desktop locked' },
    { name: 'desktop-query-failure', desktopQuery: false, expectedSends: 0, error: 'verify the input desktop' },
    { name: 'last-input-failure', inputQuery: false, expectedSends: 0, error: 'last-input timestamp' },
    { name: 'partial-input-failure', accepted: 1, error: 'input was rejected' },
    { name: 'canceled-before-send', canceled: true, expectedSends: 0 },
    { name: 'signed-tick-boundary', now: 2_147_513_649, last: -2_147_483_647 },
    { name: 'tick-wrap', now: 29_900, last: -100 },
    { name: 'future-timestamp', now: 30_000, last: 60_000, expectedSends: 0, error: 'unusable last-input timestamp' }
  ].map(sample => ({ ...defaults, ...sample }));
  const flowProgram = [
    "$ErrorActionPreference='Stop'", fixture, policy, desktopFunction, pulseFunction,
    `$allocate = {${allocation}}`,
    `$cases=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${Buffer.from(JSON.stringify(pulseCases)).toString('base64')}'))|ConvertFrom-Json`,
    '@(foreach($case in $cases){Test-StubPulse -Case $case -Allocate $allocate})|ConvertTo-Json -Compress'
  ].join('\n');
  const readTestScript = '$testSource=[Console]::In.ReadToEnd(); & ([scriptblock]::Create($testSource))';
  /** @type {unknown} */
  const checked = JSON.parse(await closedInput(helper.command, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(readTestScript, 'utf16le').toString('base64')], flowProgram));
  assert.ok(Array.isArray(checked) && checked.length === pulseCases.length);
  for (const [index, expected] of pulseCases.entries()) {
    /** @type {unknown} */
    const actual = checked[index];
    assert.ok(actual && typeof actual === 'object' &&
      'name' in actual && typeof actual.name === 'string' &&
      'sends' in actual && typeof actual.sends === 'number' &&
      'closes' in actual && typeof actual.closes === 'number' &&
      'layoutChecked' in actual && typeof actual.layoutChecked === 'boolean' &&
      'error' in actual && typeof actual.error === 'string', 'stub result must have the complete measured output shape');
    assert.equal(actual.name, expected.name);
    const diagnostic = `${expected.name}: ${JSON.stringify(actual)}`;
    assert.equal(actual.sends, expected.expectedSends, diagnostic);
    assert.equal(actual.closes, expected.expectedCloses, diagnostic);
    assert.equal(actual.layoutChecked, expected.expectedSends > 0, diagnostic);
    if (expected.error) assert.ok(actual.error.includes(expected.error), `${expected.name}: ${actual.error}`);
    else assert.equal(actual.error, '', expected.name);
  }
  console.log(`PASS ${pulseCases.length} production pulse-flow/buffer cases through stub native calls; no live mouse input API was bound or called.`);
  console.log('BOOTSTRAP/EOF ONLY: stdin is closed before helper initialization. The movement loop must not execute; this is not sleep-prevention UAT.');
  const output = await closedInput(helper.command, helper.args);
  assert.match(output, /^READY$/m);
  console.log('PASS actual Windows helper P/Invoke initialization, READY and EOF exit with no movement loop entered. No simulated input was sent.');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
