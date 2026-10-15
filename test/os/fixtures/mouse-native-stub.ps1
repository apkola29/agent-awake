class StubMouseNative {
  static [uint32]$Now
  static [int]$Last
  static [bool]$Unlocked
  static [uint32]$Session
  static [string]$Desktop
  static [int]$HeldKey
  static [bool]$InputQuery
  static [bool]$DesktopQuery
  static [uint32]$Accepted
  static [int]$Sends
  static [int]$Closes
  static [bool]$LayoutChecked

  static [uint32] WTSGetActiveConsoleSessionId() { return [StubMouseNative]::Session }
  static [IntPtr] OpenInputDesktop([uint32]$flags, [bool]$inherit, [uint32]$access) {
    if ([StubMouseNative]::Unlocked) { return [IntPtr]::new(123) }
    return [IntPtr]::Zero
  }
  static [bool] GetUserObjectInformationW([IntPtr]$desktop, [int]$index, [IntPtr]$name, [uint32]$size, [IntPtr]$required) {
    if (-not [StubMouseNative]::DesktopQuery) { return $false }
    $chars = ([StubMouseNative]::Desktop + [char]0).ToCharArray()
    [Runtime.InteropServices.Marshal]::Copy($chars, 0, $name, $chars.Length)
    [Runtime.InteropServices.Marshal]::WriteInt32($required, $chars.Length * 2)
    return $true
  }
  static [bool] CloseDesktop([IntPtr]$desktop) {
    [StubMouseNative]::Closes++
    return $true
  }
  static [bool] GetLastInputInfo([IntPtr]$info) {
    if ([Runtime.InteropServices.Marshal]::ReadInt32($info) -ne 8) { throw 'Incorrect last-input buffer layout.' }
    [Runtime.InteropServices.Marshal]::WriteInt32($info, 4, [StubMouseNative]::Last)
    return [StubMouseNative]::InputQuery
  }
  static [uint32] GetTickCount() { return [StubMouseNative]::Now }
  static [int16] GetAsyncKeyState([int]$key) {
    if ($key -eq [StubMouseNative]::HeldKey) { return -32768 }
    return 0
  }
  static [uint32] SendInput([uint32]$count, [IntPtr]$buffer, [int]$size) {
    [StubMouseNative]::Sends++
    $expected = if ([IntPtr]::Size -eq 8) { 40 } else { 28 }
    $union = if ([IntPtr]::Size -eq 8) { 8 } else { 4 }
    if ($count -ne 2 -or $size -ne $expected) { throw 'Incorrect input count or architecture size.' }
    for ($index = 0; $index -lt 2; $index++) {
      $offset = $index * $size
      $delta = if ($index -eq 0) { 1 } else { -1 }
      if ([Runtime.InteropServices.Marshal]::ReadInt32($buffer, $offset) -ne 0 -or
          [Runtime.InteropServices.Marshal]::ReadInt32($buffer, $offset + $union) -ne $delta -or
          [Runtime.InteropServices.Marshal]::ReadInt32($buffer, $offset + $union + 4) -ne 0 -or
          [Runtime.InteropServices.Marshal]::ReadInt32($buffer, $offset + $union + 8) -ne 0 -or
          [Runtime.InteropServices.Marshal]::ReadInt32($buffer, $offset + $union + 12) -ne 1 -or
          [Runtime.InteropServices.Marshal]::ReadInt32($buffer, $offset + $union + 16) -ne 0) {
        throw 'Incorrect paired mouse-only input buffer.'
      }
    }
    [StubMouseNative]::LayoutChecked = $true
    return [StubMouseNative]::Accepted
  }
}

function Test-StubPulse {
  param($Case, [scriptblock]$Allocate)
  [StubMouseNative]::Now = [uint32]$Case.now
  [StubMouseNative]::Last = [int]$Case.last
  [StubMouseNative]::Unlocked = $Case.unlocked
  [StubMouseNative]::Session = [uint32]$Case.session
  [StubMouseNative]::Desktop = $Case.desktop
  [StubMouseNative]::HeldKey = [int]$Case.heldKey
  [StubMouseNative]::InputQuery = $Case.inputQuery
  [StubMouseNative]::DesktopQuery = $Case.desktopQuery
  [StubMouseNative]::Accepted = [uint32]$Case.accepted
  [StubMouseNative]::Sends = 0
  [StubMouseNative]::Closes = 0
  [StubMouseNative]::LayoutChecked = $false
  $n = [StubMouseNative]
  $sessionId = 1
  $read = [pscustomobject]@{ IsCompleted = $Case.canceled }
  $lastInput = $inputs = $desktopName = $required = [IntPtr]::Zero
  $failure = ''
  try {
    . $Allocate
    try { Invoke-JigglePulse } catch { $failure = $_.Exception.Message + ' @ ' + $_.ScriptStackTrace }
    return [pscustomobject]@{
      name = $Case.name
      sends = [StubMouseNative]::Sends
      closes = [StubMouseNative]::Closes
      layoutChecked = [StubMouseNative]::LayoutChecked
      error = $failure
    }
  } finally {
    foreach ($pointer in @($lastInput,$inputs,$desktopName,$required)) {
      if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::FreeHGlobal($pointer) }
    }
  }
}
