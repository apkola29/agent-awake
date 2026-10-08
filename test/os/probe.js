// @ts-check
'use strict';

/**
 * Asks the operating system which power requests are in effect. Shared by the OS verification
 * script and the VS Code integration tests.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PS = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');

/**
 * @param {string} file
 * @param {string[]} args
 */
function run(file, args) {
  try {
    return execFileSync(file, args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], timeout: 60_000 });
  } catch (err) {
    const e = /** @type {any} */ (err);
    return `${e.stdout || ''}${e.stderr || ''}${e.message || ''}`;
  }
}

/** @param {number} pid */
function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return /** @type {NodeJS.ErrnoException} */ (err).code === 'EPERM';
  }
}

function isWindowsAdmin() {
  return /True/.test(run(PS, ['-NoProfile', '-NonInteractive', '-Command',
    '([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)']));
}

// CallNtPowerInformation(SystemExecutionState = 16) works without admin rights.
const WIN_QUERY = [
  "$b=[Reflection.Emit.AssemblyBuilder]::DefineDynamicAssembly((New-Object Reflection.AssemblyName('Q')),[Reflection.Emit.AssemblyBuilderAccess]::Run)",
  "$t=$b.DefineDynamicModule('Q').DefineType('Q.N','Public,Abstract,Sealed')",
  "$m=[Reflection.MethodAttributes]'Public,Static,PinvokeImpl,HideBySig'",
  "$t.DefinePInvokeMethod('CallNtPowerInformation','powrprof.dll',$m,[Reflection.CallingConventions]::Standard,[int],[Type[]]@([int],[IntPtr],[int],[IntPtr],[int]),[Runtime.InteropServices.CallingConvention]::Winapi,[Runtime.InteropServices.CharSet]::Auto).SetImplementationFlags('PreserveSig')",
  '$n=$t.CreateType()',
  '$p=[Runtime.InteropServices.Marshal]::AllocHGlobal(4)',
  '$s=$n::CallNtPowerInformation(16,[IntPtr]::Zero,0,$p,4)',
  "[Console]::Out.WriteLine(('{0} {1}' -f $s,[uint32][Runtime.InteropServices.Marshal]::ReadInt32($p)))"
].join(';');

/**
 * @param {number[]} [pids] Helper pids to look for (macOS and Linux report requests per process).
 * @returns {{ system: boolean, display: boolean, raw: string }}
 */
function probe(pids = []) {
  if (process.platform === 'win32') {
    const out = run(PS, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', WIN_QUERY]).trim();
    const [status, value] = out.split(/\s+/).map(Number);
    if (status !== 0 || !Number.isFinite(value)) {
      return { system: false, display: false, raw: `query failed: ${out}` };
    }
    return { system: (value & 1) !== 0, display: (value & 2) !== 0, raw: `SystemExecutionState=0x${value.toString(16).padStart(8, '0')}` };
  }
  if (process.platform === 'darwin') {
    const out = run('pmset', ['-g', 'assertions']);
    const mine = out.split('\n').filter(l => pids.some(p => l.includes(`pid ${p}(`)));
    return {
      system: mine.some(l => l.includes('PreventUserIdleSystemSleep')),
      display: mine.some(l => l.includes('PreventUserIdleDisplaySleep')),
      raw: mine.map(l => l.trim()).join(' | ') || 'no assertions from helper'
    };
  }
  const out = run('systemd-inhibit', ['--list', '--no-pager']);
  const mine = out.split('\n').filter(l => l.includes('Agent Keep-Awake') || pids.some(p => new RegExp(`\\b${p}\\b`).test(l)));
  return {
    system: mine.some(l => /\bsleep\b/.test(l)),
    display: mine.some(l => /\bidle\b/.test(l)),
    raw: mine.map(l => l.replace(/\s+/g, ' ').trim()).join(' | ') || 'no inhibitors from helper'
  };
}

/**
 * CPU seconds used so far and resident memory of a process.
 * @param {number} pid
 * @returns {{ cpu: number, rssMB: number }}
 */
function footprint(pid) {
  if (process.platform === 'win32') {
    const out = run(PS, ['-NoProfile', '-NonInteractive', '-Command',
      `$p=Get-Process -Id ${pid}; [Console]::Out.WriteLine(('{0} {1}' -f $p.TotalProcessorTime.TotalSeconds,($p.WorkingSet64/1MB)).Replace(',','.'))`]).trim();
    const [cpu, rss] = out.split(/\s+/).map(Number);
    return { cpu, rssMB: rss };
  }
  if (process.platform === 'linux') {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const ticks = Number(fields[11]) + Number(fields[12]);
    return { cpu: ticks / 100, rssMB: (Number(fields[21]) * 4096) / 1048576 };
  }
  const out = run('ps', ['-o', 'rss=,time=', '-p', String(pid)]).trim();
  const [rssKb, time] = out.split(/\s+/);
  const cpu = time.split(':').map(Number).reduce((acc, v) => acc * 60 + v, 0);
  return { cpu, rssMB: Number(rssKb) / 1024 };
}

module.exports = { probe, footprint, isAlive, isWindowsAdmin, run };
