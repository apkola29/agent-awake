// @ts-check
'use strict';

/** Fixed local helper code, encoded as data for PowerShell rather than interpolated into a shell command. */
function windowsMouseJiggleScript() {
  return String.raw`
$ErrorActionPreference = 'Stop'
$assembly = [Reflection.Emit.AssemblyBuilder]::DefineDynamicAssembly(
  [Reflection.AssemblyName]::new('AgentAwakeMouse'), [Reflection.Emit.AssemblyBuilderAccess]::Run)
$type = $assembly.DefineDynamicModule('Native').DefineType('AgentAwakeMouse.Native', 'Public,Abstract,Sealed')
function Add-Native {
  param([string]$Name, [string]$Library, [Type]$Return, [Type[]]$Arguments)
  $method = $type.DefinePInvokeMethod($Name, $Library,
    [Reflection.MethodAttributes]'Public,Static,PinvokeImpl,HideBySig',
    [Reflection.CallingConventions]::Standard, $Return, $Arguments,
    [Runtime.InteropServices.CallingConvention]::Winapi, [Runtime.InteropServices.CharSet]::Unicode)
  $method.SetImplementationFlags('PreserveSig')
}
Add-Native GetLastInputInfo user32.dll ([bool]) @([IntPtr])
Add-Native GetTickCount kernel32.dll ([uint32]) @()
Add-Native WTSGetActiveConsoleSessionId kernel32.dll ([uint32]) @()
Add-Native OpenInputDesktop user32.dll ([IntPtr]) @([uint32],[bool],[uint32])
Add-Native GetUserObjectInformationW user32.dll ([bool]) @([IntPtr],[int],[IntPtr],[uint32],[IntPtr])
Add-Native CloseDesktop user32.dll ([bool]) @([IntPtr])
Add-Native GetAsyncKeyState user32.dll ([int16]) @([int])
Add-Native SendInput user32.dll ([uint32]) @([uint32],[IntPtr],[int])
Add-Native K32EmptyWorkingSet kernel32.dll ([bool]) @([IntPtr])
$n = $type.CreateType()

function Get-JiggleAction {
  param([bool]$Unlocked, [double]$IdleSeconds, [bool]$Pressed)
  if (-not $Unlocked) { return 'stop' }
  if ($Pressed -or $IdleSeconds -lt 30 -or $IdleSeconds -gt 86400) { return 'skip' }
  return 'move'
}

function Test-InteractiveDesktop {
  if ($n::WTSGetActiveConsoleSessionId() -ne $sessionId) { return $false }
  $desktop = $n::OpenInputDesktop(0, $false, 1)
  if ($desktop -eq [IntPtr]::Zero) { return $false }
  try {
    if (-not $n::GetUserObjectInformationW($desktop, 2, $desktopName, 256, $required)) {
      throw 'Mouse jiggle could not verify the input desktop.'
    }
    return [Runtime.InteropServices.Marshal]::PtrToStringUni($desktopName) -eq 'Default'
  } finally {
    if (-not $n::CloseDesktop($desktop)) { throw 'Mouse jiggle could not close its desktop query handle.' }
  }
}

$lastInput = [IntPtr]::Zero
$inputs = [IntPtr]::Zero
$desktopName = [IntPtr]::Zero
$required = [IntPtr]::Zero
$process = [Diagnostics.Process]::GetCurrentProcess()
try { $sessionId = $process.SessionId } finally { $process.Dispose() }
try {
  $lastInput = [Runtime.InteropServices.Marshal]::AllocHGlobal(8)
  [Runtime.InteropServices.Marshal]::WriteInt32($lastInput, 8)
  $inputSize = if ([IntPtr]::Size -eq 8) { 40 } else { 28 }
  $unionOffset = if ([IntPtr]::Size -eq 8) { 8 } else { 4 }
  $inputs = [Runtime.InteropServices.Marshal]::AllocHGlobal(2 * $inputSize)
  [Runtime.InteropServices.Marshal]::Copy([byte[]]::new(2 * $inputSize), 0, $inputs, 2 * $inputSize)
  [Runtime.InteropServices.Marshal]::WriteInt32($inputs, $unionOffset, 1)
  [Runtime.InteropServices.Marshal]::WriteInt32($inputs, $inputSize + $unionOffset, -1)
  [Runtime.InteropServices.Marshal]::WriteInt32($inputs, $unionOffset + 12, 1)
  [Runtime.InteropServices.Marshal]::WriteInt32($inputs, $inputSize + $unionOffset + 12, 1)
  $desktopName = [Runtime.InteropServices.Marshal]::AllocHGlobal(256)
  $required = [Runtime.InteropServices.Marshal]::AllocHGlobal(4)
  if (-not (Test-InteractiveDesktop)) { throw 'Mouse jiggle requires the unlocked physical-console desktop. Start again manually after unlocking.' }
  $stdin = [Console]::OpenStandardInput()
  $read = $stdin.ReadAsync([byte[]]::new(1), 0, 1)
  [GC]::Collect()
  [void]$n::K32EmptyWorkingSet([IntPtr](-1))
  [Console]::Out.WriteLine('READY')
  [Console]::Out.Flush()
  $trimmed = $false
  while (-not $read.Wait(30000)) {
    if (-not $trimmed) {
      [GC]::Collect()
      [void]$n::K32EmptyWorkingSet([IntPtr](-1))
      $trimmed = $true
    }
    $unlocked = Test-InteractiveDesktop
    if (-not $n::GetLastInputInfo($lastInput)) { throw 'Mouse jiggle could not query the last-input timestamp.' }
    $lastTick = ([long][Runtime.InteropServices.Marshal]::ReadInt32($lastInput, 4) + 4294967296) % 4294967296
    $idle = (([long]$n::GetTickCount() - [long]$lastTick + 4294967296) % 4294967296) / 1000.0
    $pressed = $false
    foreach ($key in 1,2,4,5,6,16,17,18,91,92) {
      if (($n::GetAsyncKeyState($key) -band 0x8000) -ne 0) { $pressed = $true; break }
    }
    $action = Get-JiggleAction -Unlocked $unlocked -IdleSeconds $idle -Pressed $pressed
    if ($action -eq 'stop') { throw 'Mouse jiggle stopped because the desktop locked or the console session changed. Start again manually.' }
    if ($action -eq 'move') {
      if ($read.IsCompleted) { break }
      if ($n::SendInput([uint32]2, $inputs, $inputSize) -ne 2) { throw 'Mouse jiggle input was rejected; the helper has stopped.' }
    }
  }
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 4
} finally {
  foreach ($pointer in @($lastInput,$inputs,$desktopName,$required)) {
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::FreeHGlobal($pointer) }
  }
}
`.trim();
}

module.exports = { windowsMouseJiggleScript };
