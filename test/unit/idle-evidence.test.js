// @ts-check
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const script = fs.readFileSync(path.join(__dirname, '..', 'os', 'verify-idle-windows.ps1'), 'utf8');

test('idle verification reports protected interval and owned-helper release times', () => {
  for (const label of [
    'INFO protected interval end:', 'acQuerySucceeded', 'acLineStatus', 'ownerAlive',
    'INFO owned helper release begins:', 'INFO owned helper cleanup finished:'
  ]) {
    assert.ok(script.includes(label), `missing evidence field: ${label}`);
  }
});

test('a real standby event cannot be hidden by an inconclusive end-of-test power source', () => {
  const eventFailure = script.indexOf('FAILED: Windows entered sleep/Modern Standby during the active combined request.');
  const powerInconclusive = script.indexOf('INCONCLUSIVE: AC power was not confirmed at interval end');
  assert.ok(eventFailure >= 0 && powerInconclusive > eventFailure);
  assert.match(script, /\$powerQuerySucceeded = \[AwakeIdleTestNative\]::GetSystemPowerStatus/);
});

test('bounded genuine-idle mode preserves the requested no-input threshold', () => {
  assert.match(script, /\$minimumIdle = if \(\$WaitForIdleSeconds -gt 0\) \{ \$Seconds \}/);
  assert.match(script, /if \(\$idle -lt \$minimumIdle\)/);
  assert.match(script, /No idle-test helper was started; attribution requires a clean baseline/);
});

test('failed or inconclusive idle checks still measure native release without hiding the original failure', () => {
  const release = script.indexOf('$released = Read-PowerState');
  const report = script.indexOf('INFO released native power state:');
  const failure = script.lastIndexOf('if ($failure) { throw $failure }');
  assert.ok(release >= 0 && report > release && failure > report);
  assert.ok(script.includes('[Exception[]]@($failure, $_.Exception)'));
});
