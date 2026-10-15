// @ts-check
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, '..', 'os', 'observe-window-windows.ps1'), 'utf8');

test('actual-window observation cannot create a power hold, inject input or stop a user process', () => {
  assert.doesNotMatch(script, /\b(?:SetThreadExecutionState|PowerSetRequest|Stop-Process|Start-Process|SendInput)\b|\.acquire\(/);
});

test('actual-window observation rejects mismatched loaded version and helper ownership', () => {
  assert.ok(script.includes('$ExpectedVersion'));
  assert.ok(script.includes('$helper.CreationDate -lt $loadedAt'));
  assert.ok(script.includes('$helper.ParentProcessId'));
  assert.ok(script.includes('2147483651'));
  assert.ok(script.includes('$logFile.FullName.StartsWith($logRoot'));
});

test('actual-window observation requires genuine idle and checks standby before input inconclusive', () => {
  assert.ok(script.indexOf('if ($events.Count)') < script.indexOf('if ($idle -lt $Seconds)'));
  assert.ok(script.includes('if ($idle -lt $Seconds)'));
  assert.ok(script.includes('WTSGetActiveConsoleSessionId'));
  assert.ok(script.includes('$Seconds -le [Math]::Max($sleep, $display)'));
});
