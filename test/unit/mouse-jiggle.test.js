// @ts-check
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { windowsMouseJiggleScript } = require('../../src/windowsMouseJiggle');

test('mouse fallback has one interruptible wait and no policy changes, clicks, keyboard input or per-pulse process', () => {
  const script = windowsMouseJiggleScript();
  assert.match(script, /OpenStandardInput\(\)/);
  assert.match(script, /while \(-not \$read\.Wait\(30000\)\)/);
  assert.match(script, /Get-JiggleAction/);
  assert.match(script, /WTSGetActiveConsoleSessionId/);
  assert.match(script, /OpenInputDesktop/);
  assert.match(script, /GetAsyncKeyState/);
  assert.match(script, /SendInput\(\[uint32\]2/);
  assert.doesNotMatch(script, /SetThreadExecutionState|PowerSetRequest|Start-Process|Add-Type|SetCursorPos|Set-Content|Registry|powercfg|ExecutionPolicy|keybd_event/i);
  assert.ok(script.indexOf("if ($action -eq 'move')") < script.indexOf('::SendInput('));
  assert.ok(script.includes('CloseDesktop'));
  assert.ok(script.includes('FreeHGlobal'));
  assert.match(script, /function Invoke-JigglePulse/);
  assert.match(script, /Invoke-JigglePulse\s*\r?\n\s*\}/);
});

test('pulse policy is bounded, stops on an inaccessible desktop and skips recent or held input', () => {
  const policy = windowsMouseJiggleScript().match(/function Get-JiggleAction \{[\s\S]*?\r?\n\}/)?.[0];
  assert.ok(policy);
  assert.match(policy, /if \(-not \$Unlocked\) \{ return 'stop' \}/);
  assert.match(policy, /\$Pressed -or \$IdleSeconds -lt 30 -or \$IdleSeconds -gt 86400/);
  assert.ok(policy.indexOf("return 'skip'") < policy.indexOf("return 'move'"));
});
