// @ts-check
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
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
  assert.ok(script.indexOf('if ($events.Count)') < script.indexOf('if (-not (Test-GenuineIdle'));
  assert.ok(script.includes('if (-not (Test-GenuineIdle'));
  assert.ok(script.includes('WTSGetActiveConsoleSessionId'));
  assert.ok(script.includes('$Seconds -le [Math]::Max($sleep, $display)'));
});

test('native age samples last input before current time and independently measures a quiet interval', () => {
  assert.match(script, /var lastInput = InputTick\(\);\s*return unchecked\(GetTickCount\(\) - lastInput\)/);
  assert.ok(script.includes('[Diagnostics.Stopwatch]::StartNew()'));
  assert.ok(script.includes('$quietSince = $clock.Elapsed.TotalSeconds'));
  assert.ok(script.includes('observedQuietSeconds = $observedQuiet'));
});

test('real PowerShell acceptance predicate requires both thresholds, including exact equality', {
  skip: process.platform !== 'win32'
}, () => {
  const predicate = script.match(/function Test-GenuineIdle \{[\s\S]*?\r?\n\}/)?.[0];
  assert.ok(predicate);
  const cases = [
    { native: 239.999, quiet: 300, expected: false },
    { native: 300, quiet: 239.999, expected: false },
    { native: 240, quiet: 240, expected: true },
    { native: 0, quiet: 300, expected: false },
    { native: 4294967, quiet: 2, expected: false },
    { native: 300, quiet: 300, expected: true }
  ];
  const payload = Buffer.from(JSON.stringify(cases)).toString('base64');
  const command = [
    "$ErrorActionPreference='Stop'",
    predicate,
    `$cases=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${payload}'))|ConvertFrom-Json`,
    '$results=@(foreach($sample in $cases){Test-GenuineIdle -NativeIdleSeconds $sample.native -ObservedQuietSeconds $sample.quiet -RequiredSeconds 240})',
    '$results|ConvertTo-Json -Compress'
  ].join('\n');
  const executable = path.win32.join(process.env.SystemRoot || 'C:\\Windows',
    'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const output = execFileSync(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand',
    Buffer.from(command, 'utf16le').toString('base64')], {
    encoding: 'utf8', windowsHide: true, timeout: 4000
  });
  assert.deepEqual(JSON.parse(output), cases.map(sample => sample.expected));
});
