param(
  [Parameter(Mandatory)][string]$ExtensionLog,
  [Parameter(Mandatory)][string]$ProbePath,
  [Parameter(Mandatory)][string]$ExpectedVersion,
  [string]$CodeLogsRoot = (Join-Path $env:APPDATA 'Code\logs'),
  [ValidateRange(240, 1200)][int]$Seconds = 240
)

$ErrorActionPreference = 'Stop'
if (-not $IsWindows) { throw 'This observer requires Windows.' }
$logFile = Get-Item -LiteralPath $ExtensionLog
$logRoot = [IO.Path]::GetFullPath($CodeLogsRoot) + '\'
if (-not $logFile.FullName.StartsWith($logRoot, [StringComparison]::OrdinalIgnoreCase) -or
    $logFile.Name -ne 'Agent Awake.log' -or $logFile.Directory.Name -ne 'apkola29.agent-keep-awake') {
  throw 'The observer requires this extension log under the explicitly selected Code log directory.'
}
if (-not [IO.Path]::IsPathRooted($ProbePath) -or -not (Test-Path -LiteralPath $ProbePath -PathType Leaf)) {
  throw 'An existing absolute native-probe path is required.'
}

$lines = Get-Content -LiteralPath $logFile.FullName
$loaded = @($lines | Select-String -Pattern 'Agent Awake ([0-9.]+) loaded\.')
if (-not $loaded.Count -or $loaded[-1].Matches[0].Groups[1].Value -ne $ExpectedVersion) {
  throw "INCONCLUSIVE: the actual window log does not confirm loaded version $ExpectedVersion."
}
$loadedAt = [datetime]::ParseExact($loaded[-1].Line.Substring(0, 23), 'yyyy-MM-dd HH:mm:ss.fff', [Globalization.CultureInfo]::InvariantCulture)
$starts = @($lines | Select-String -Pattern 'powershell started \(pid ([0-9]+)\)')
if (-not $starts.Count) { throw 'INCONCLUSIVE: this window has not started a manual power helper. Turn the actual cup on first.' }
$helperPid = [int]$starts[-1].Matches[0].Groups[1].Value
$helper = Get-CimInstance Win32_Process -Filter "ProcessId=$helperPid"
if (-not $helper -or $helper.CreationDate -lt $loadedAt -or
    $helper.Name -notin @('powershell.exe', 'pwsh.exe') -or $helper.CommandLine -notmatch '2147483651') {
  throw 'INCONCLUSIVE: the logged helper is not a live combined system/display helper from this activation.'
}
$hostLog = Join-Path $logFile.Directory.Parent.FullName 'exthost.log'
$hosts = @(Get-Content -LiteralPath $hostLog -Tail 1000 | Select-String -Pattern 'Extension host with pid ([0-9]+) started')
if (-not $hosts.Count -or [int]$hosts[-1].Matches[0].Groups[1].Value -ne $helper.ParentProcessId) {
  throw 'INCONCLUSIVE: helper ownership does not match this actual window extension host.'
}
$birth = $helper.CreationDate

Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class AwakeActualWindowObserver {
  [StructLayout(LayoutKind.Sequential)] public struct Input { public uint Size, Tick; }
  [StructLayout(LayoutKind.Sequential)] public struct Power { public byte ACLineStatus, BatteryFlag, BatteryPercent, SaverFlag; public uint Life, FullLife; }
  [DllImport("user32.dll", SetLastError=true)] private static extern bool GetLastInputInfo(ref Input info);
  [DllImport("kernel32.dll")] private static extern uint GetTickCount();
  [DllImport("kernel32.dll")] public static extern uint WTSGetActiveConsoleSessionId();
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool GetSystemPowerStatus(out Power power);
  [DllImport("powrprof.dll")] private static extern uint PowerGetActiveScheme(IntPtr key, out IntPtr scheme);
  [DllImport("powrprof.dll")] private static extern uint PowerReadACValueIndex(IntPtr key, ref Guid scheme, ref Guid group, ref Guid setting, out uint value);
  [DllImport("kernel32.dll")] private static extern IntPtr LocalFree(IntPtr memory);
  public static uint InputTick() {
    var info = new Input { Size = 8 };
    if (!GetLastInputInfo(ref info)) throw new InvalidOperationException("Last-input query failed.");
    return info.Tick;
  }
  public static double IdleSeconds() {
    return unchecked(GetTickCount() - InputTick()) / 1000.0;
  }
  public static uint AcTimeout(Guid group, Guid setting) {
    IntPtr pointer;
    if (PowerGetActiveScheme(IntPtr.Zero, out pointer) != 0) throw new InvalidOperationException("Active-scheme query failed.");
    try {
      var scheme = Marshal.PtrToStructure<Guid>(pointer);
      uint value;
      if (PowerReadACValueIndex(IntPtr.Zero, ref scheme, ref group, ref setting, out value) != 0) throw new InvalidOperationException("AC timeout query failed.");
      return value;
    } finally { LocalFree(pointer); }
  }
}
'@

function Read-Native {
  $text = & node -e 'console.log(JSON.stringify(require(process.argv[1]).probe()))' $ProbePath
  if ($LASTEXITCODE -ne 0) { throw 'Native execution-state query failed.' }
  $value = $text | ConvertFrom-Json
  if ($value.system -isnot [bool] -or $value.display -isnot [bool]) { throw 'Malformed native state.' }
  return $value
}

if ([Diagnostics.Process]::GetCurrentProcess().SessionId -ne [AwakeActualWindowObserver]::WTSGetActiveConsoleSessionId()) {
  throw 'INCONCLUSIVE: this observer is not in the physical-console session.'
}
$power = [AwakeActualWindowObserver+Power]::new()
if (-not [AwakeActualWindowObserver]::GetSystemPowerStatus([ref]$power) -or $power.ACLineStatus -ne 1) {
  throw 'INCONCLUSIVE: AC power is required.'
}
$sleep = [AwakeActualWindowObserver]::AcTimeout([guid]'238c9fa8-0aad-41ed-83f4-97be242c8f20', [guid]'29f6c1db-86da-48c5-9fdb-f2b67b1f44da')
$display = [AwakeActualWindowObserver]::AcTimeout([guid]'7516b95f-f776-4464-8c53-06167f40cc99', [guid]'3c0bc021-c8a8-4e07-a973-6b14cbcb2b7e')
if ($sleep -eq 0 -or $display -eq 0 -or $Seconds -le [Math]::Max($sleep, $display)) {
  throw "INCONCLUSIVE: observation must exceed finite existing idle policies. Sleep=$sleep; display=$display."
}
$held = Read-Native
if (-not $held.system -or -not $held.display) { throw 'INCONCLUSIVE: the actual window is not holding combined native requests.' }
$begin = Get-Date
Write-Output "INFO observing ACTUAL window version=$ExpectedVersion; helper=$helperPid; parent=$($helper.ParentProcessId); sleep=$sleep; display=$display; flags=$($held.raw); begin=$($begin.ToString('o'))."
Write-Output 'INFO this observer creates no power hold, injects no input, changes no policy, and will not stop the existing application helper.'
$minimumEnd = $begin.AddSeconds($Seconds)
$deadline = $minimumEnd.AddSeconds(60)
$previousInput = [AwakeActualWindowObserver]::InputTick()
$inputChanges = 0
do {
  Start-Sleep -Seconds 5
  $currentInput = [AwakeActualWindowObserver]::InputTick()
  if ($currentInput -ne $previousInput) {
    $inputChanges++
    $inputAt = (Get-Date).AddSeconds(-[AwakeActualWindowObserver]::IdleSeconds())
    Write-Output "INFO native input timestamp changed: $($inputAt.ToString('o')); timestamp metadata only, no input content."
    $previousInput = $currentInput
  }
} while (((Get-Date) -lt $minimumEnd -or [AwakeActualWindowObserver]::IdleSeconds() -lt $Seconds) -and (Get-Date) -lt $deadline)
$end = Get-Date
$idle = [AwakeActualWindowObserver]::IdleSeconds()
$endPower = [AwakeActualWindowObserver+Power]::new()
$powerOk = [AwakeActualWindowObserver]::GetSystemPowerStatus([ref]$endPower)
$held = Read-Native
Write-Output ('INFO actual-window interval end: ' + (@{
  begin = $begin.ToString('o'); end = $end.ToString('o'); idleSeconds = $idle
  acQuerySucceeded = $powerOk; acLineStatus = $endPower.ACLineStatus; flags = $held.raw; inputTimestampChanges = $inputChanges
} | ConvertTo-Json -Compress))
$events = @()
try {
  $events = @(Get-WinEvent -FilterHashtable @{
    LogName = 'System'; ProviderName = 'Microsoft-Windows-Kernel-Power'
    Id = @(42, 506); StartTime = $begin; EndTime = $end
  } -MaxEvents 20)
} catch {
  if ($_.FullyQualifiedErrorId -notlike 'NoMatchingEventsFound*') { throw }
}
if ($events.Count) {
  $events | Select-Object TimeCreated, Id, Message | Format-List | Out-Host
  throw 'FAILED: Windows entered sleep/Modern Standby during the actual application hold.'
}
if (-not $powerOk -or $endPower.ACLineStatus -ne 1) { throw 'INCONCLUSIVE: end-of-interval AC power was not confirmed.' }
if ($idle -lt $Seconds) { throw "INCONCLUSIVE: actual idle=$idle seconds; required=$Seconds. Do not count continuing input as a pass." }
$current = Get-CimInstance Win32_Process -Filter "ProcessId=$helperPid"
if (-not $current -or $current.CreationDate -ne $birth -or $current.ParentProcessId -ne $helper.ParentProcessId) {
  throw 'FAILED: the original actual-window helper did not survive the interval.'
}
if (-not $held.system -or -not $held.display) { throw 'FAILED: the actual window lost its native requests.' }
Write-Output "PASS actual-window idle=$idle seconds beyond unchanged policies; same owned helper; no sleep/standby events; native combined requests remain held."
Write-Output 'INFO observation only: the user application session was left unchanged. This single result is not publication approval.'
