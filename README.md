# Agent Awake

> **Distribution paused: not validated for unattended work.**
> The 1.2.2 GitHub download has been withdrawn, GitHub Pages disabled, and the
> Marketplace listing unpublished. Do not rely on this prototype to prevent
> unattended sleep. Passing API/command tests are not hardware acceptance proof.

**Click the ready coffee cup before a long run. Click the green cup when you are done.**

Agent Awake requests local system and screen activity while you explicitly
enable it. Use your normal Copilot, Claude, build, or other application;
no replacement chat, model account, or `@awake` prompt is needed.
Opening VS Code starts **Off**. The default active session has **no expiry**,
but ends when you click again, turn Off, or close/reload its owning window.

**Windows limitation:** the screen stays on while enabled. Use AC power.
Explicit Sleep, lid closure, lock/battery/company policies can override requests.
Green means a native request was acknowledged, not immunity from forced sleep.
Automatic Copilot activity detection is **not implemented** in this release.

The public name is Agent Awake. The original extension ID
`apkola29.agent-keep-awake` and `agentKeepAwake.*` settings/commands are retained
so existing installations receive an update instead of a second extension.
This guide describes the withdrawn **1.2.2 prototype**. Real idle acceptance
must be performed using the version actually loaded in the affected window,
not merely the version installed on disk or running in another test window.

## Local-only mouse-jiggle prototype (1.3.0 source)

The latest source adds **Agent Awake: Start Experimental Mouse Jiggle...** in
the Command Palette. It is not installed or publicly distributed. The normal
cup and native commands still use the original power-request route; there is
no persistent mouse-jiggle setting and no automatic activation.

For supervised development testing, start with **Off**, run that explicit
command, and read its per-session warning. Only choosing **Start mouse jiggle**
starts the helper. Canceling, turning Off while the warning is open, or leaving
an existing session active will not silently enable input. It uses the configured
Duration (Hours), including 0/until-off. Clicking its active cup, expiry, window
close/reload or helper failure stops the owned session.

- One persistent Windows PowerShell helper waits 30 seconds between checks;
  no app/process is launched for each pulse, and no runtime package is added.
- It attempts a tiny paired relative mouse movement only after at least
  30 seconds of input inactivity, with no mouse button or modifier held.
  It sends no clicks or keyboard events. Pointer acceleration/screen edges
  can affect the resulting movement; exact cursor restoration is not promised.
- It requires the unlocked physical-console desktop. Lock/session change or
  an inaccessible desktop stops it rather than attempting to unlock or resume.
  Unexpected exit never automatically restarts synthetic input.
- Initialization is bounded to 20 seconds because this route also verifies
  desktop/session access. A timeout releases the helper, so a late startup
  cannot begin input after reporting failure. Native startup keeps its existing
  10-second bound.
- **Synthetic input can affect pointer use and delay automatic locking.**
  Use it only where device/organization policy permits. It does not change
  power plans, security settings or permissions, and never requests elevation.
- This route holds no additional native power request, reads no chat content,
  and does not detect Copilot/Claude work. It always shows **Unverified**, never
  confirmed green: a running helper is not proof that Windows will stay awake.

This is a compatibility experiment, not a measured CPU/memory improvement or
a verified sleep fix. Distribution stays withdrawn. Automated checks do not
send live synthetic input; the Windows startup check precloses stdin before
initialization, so the movement loop cannot run.

The guard checker also executes the production pulse function and buffer
allocation against a stub native class. It checks the paired mouse-only buffer,
idle boundaries, held input, locked/changed desktop, canceled input, partial
rejection and 32-bit tick wrap. These are control-flow and memory-layout checks,
not evidence that a live Windows input event prevents sleep.

```powershell
node .\test\os\verify-windows-guards.js
```

## Use it in VS Code

Requirements: **desktop VS Code 1.95 or newer**. Manual power control needs
no hooks, model account, API key, or subscription. Windows is the validated
native-request target; macOS/Linux protection remains explicitly unverified.

1. This is for supervised local testing only; do not distribute or rely on the
   withdrawn package. Before a test, use **Agent Awake: Show Log** in the actual
   window being tested and verify its loaded version. Reload an older window
   only when its agent work is safe to interrupt. Reload starts Off.
2. **Click `@awake ready` once.** No picker or confirmation is needed.
3. On Windows, wait for the acknowledged **green cup**, then use normal Copilot,
   Claude, or any other application. No `@awake` prefix or model replacement is required.
4. **Click the green cup again** when done, or run **Agent Awake: Turn Off**.
   Off disables only this extension's protection and never cancels native Copilot.

The coffee click uses **Duration (Hours)**, which defaults to **0** (no expiry).
Open **Settings**, search `@ext:apkola29.agent-keep-awake`, and set the duration:

| Value | Session |
|---|---|
| `0` | Live-forever mode: until you turn it off or close/reload its VS Code window |
| `0.5` | 30 minutes |
| `1` | 1 hour |
| `2`, `4`, `8`, etc. | That many hours, up to 24 |

### What the cup looks like

| Off: click to start | On: click to stop |
|---|---|
| ![Neutral coffee cup with the label @awake ready](docs/images/awake-ready.png) | ![Compact green coffee cup without the ready label](docs/images/awake-on.png) |

These supplied UI illustrations are cropped to the control. They show its
appearance, not evidence that the latest build passed an unattended sleep test.
The tooltip and screen-reader label also announce the state; color alone is
not the only indication.

You can also run **Agent Awake: Configure Duration (Hours)** from the
Command Palette. The setting applies to the **next** session only; changing it
does not silently extend, shorten, or disable a session already running.
The duration is an application setting, not a workspace-file override.

For a one-off duration without changing the default, use **Agent Awake:
Choose Duration for a Timed Session**: 30 minutes, 1, 2, 4, or 8 hours,
or **Until I turn it off**.
Live-forever mode has no expiry timer, but it never starts by itself or survives
closing/reloading the window.

**Manual mode does not detect chat completion.** Pressing Stop in a chat does
not switch Agent Awake off. Click the green cup or use **Agent Awake: Turn Off**.
Selecting Off never aborts or modifies Copilot work.

| Coffee status | Meaning |
|---|---|
| Neutral cup with **@awake ready** | Ready to activate, but not preventing sleep |
| Spinner **Keep Awake: Starting...** | Waiting for the OS to accept protection; not yet confirmed |
| Green cup only, with no ready text | The OS helper has acknowledged active protection; the item shrinks so adjacent icons shift |
| Warning **Keep Awake: Failed** | Protection could not start or was lost; sleep is allowed |
| **Auto: Unavailable** | No supported native-hook profile has been verified; no power hold |
| **Keep Awake: Unverified** on macOS/Linux | A helper may be running, but this build has no native acknowledgement proof; never shown as confirmed green |
| **Mouse jiggle: Unverified** | An explicitly approved experimental input helper may be running; it is never proof that sleep is blocked |

The tooltip explains **Off**, **Manual**, or **Auto**, confirmed protection,
owner count, and any deadline. Click to turn your configured session on or off.
Hover to see expiry date/time, or **until you turn it off**.
The screen-reader label
also announces On or Off; green follows the theme's success color. Opening another window
does not activate it. Closing/reloading the owning window clears its session.
There is no persistent always-on setting or editor-activity heuristic.
Old `enabled`, `mode`, and activity-timeout settings are ignored.
**Show Status** gives a short plain-English explanation; **Show Log** shows
technical lifecycle diagnostics. Hiding the icon does not stop an active session.

## Auto - Copilot activity: unavailable in this preview

Supported native hooks exist, but complete terminal/cancellation behavior and
window-instance routing have not been verified for the current Local or Copilot
Agent Host runtime. A `Stop` hook may require another turn; it is not proof that
work ended. Some session and operation identifiers are optional or absent.

Selecting Auto from Off shows **Auto: Unavailable**, with no power helper,
monitoring timer, local IPC endpoint, or hook configuration changes. Attempting
unavailable Auto while Manual is active preserves that hold and explains why.
Choose Keep awake when you need reliable explicit ownership.

The old `@awake` participant is no longer contributed or bundled. No prompts
are rerouted, no model is selected, and no tool permission is changed. Its
historical regression tests remain in the development repository only.

## What is protected

| Situation | This extension's behavior |
|---|---|
| Keep awake | One local hold until Off or owning-window exit; independent of chat/app activity |
| Timed coffee session | Hold protection until stopped, expired, or its window closes |
| Live-forever coffee session (`Duration (Hours) = 0`) | No expiry; still releases on Off, window close/reload, or helper failure |
| Normal Copilot/Claude chat during Manual | Request local sleep protection; read no chat content |
| Auto with no verified adapter | Unavailable; do not guess activity or acquire power |
| OS protection unavailable or lost | Clear green; report failure/retry without cancelling native Copilot |
| Window close, reload, or extension-host exit | Release the helper owned by that window |
| Ordinary editor activity while Off | No power request |
| Other windows or applications holding power | Off releases only this extension's window, not another owner's request |

## Free and entirely local

The extension is free and MIT-licensed. Manual controls read no chat content
and need no sign-in, API key, model access, or subscription. There are no
production runtime dependencies, listening servers, telemetry, or cloud calls.
Your normal chat provider keeps its own account, consent, plan, and usage rules;
this extension neither uses nor bypasses them.

No personal transcripts, private chat storage, credentials, or provider logs
are watched. Other chats are not modified. Only maintainers need publication
credentials; local installation does not.

## Security and cleanup boundaries

- The coffee control makes no model, network, authentication, or telemetry calls.
  It starts only a local, platform-native helper with fixed commands and arguments.
- It opens no listening port, requests no elevation, and writes no power plan or
  registry policy. Native mode never simulates input. Only the separate
  experimental mouse command can generate synthetic pointer input, after fresh
  explicit consent for that session.
- Manual uses fixed local commands and no workspace execution. The mouse
  experiment uses a fixed encoded script, not workspace arguments. Auto requires
  a separately verified trusted local runtime, which is not enabled here.
- Settings are application-scoped; workspace files cannot silently choose
  indefinite protection or hide its control. There is no persistent On setting.
- Only one coordinator owns the backend. Owner identities include instance,
  generation and source, with idempotent begin/end and stale-event rejection.
  Internal mock-adapter tests do not establish native Copilot coverage.
- Logs contain mode/state/count/deadline diagnostics, never prompts,
  transcript paths, hook capabilities, credentials, or tool data.
- Each window owns its helper. Off, expiry and disposal clear its owners/timers.
  Host exit releases the platform helper. Helper failure clears confirmation,
  while bounded backend retry may restore a still-desired hold.
- No native chat is cancelled because power protection fails or is disabled.
- The packaged runtime contains no LLM client, chat participant, IPC bridge,
  hook client, hook configuration, or historical chat-processing module.

The earlier optional-chat attachment issue was mitigated in its historical
implementation; that route is now excluded from the shipped runtime entirely.
Bounded review and passing tests do not prove all possible defects are absent.

## Lightweight and bounded

- No polling, timers, or helper process while Off.
- A timed session uses one expiry timer, not a countdown polling loop.
- Live-forever mode uses no expiry timer. Invalid durations fail visibly
  instead of silently falling back to an hour or enabling indefinite protection.
- One small OS helper per active window on Windows/macOS; Linux may use two
  native inhibitors for desktop compatibility.
- Experimental mouse mode uses one interruptible 30-second wait and the same
  owner/coordinator; it is not a per-frame loop or a second helper beside native
  mode. Its footprint has not been benchmarked and must not be called lighter.
- Native Windows mode uses `SetThreadExecutionState`; macOS uses `caffeinate`; Linux uses
  `systemd-inhibit` and/or `gnome-session-inhibit`.
- **Native Windows mode requests that the screen stays on while enabled**, using combined system and
  display activity requests. This is required to address idle Modern Standby
  on machines where system-only requests allow screen-off standby entry.
  macOS/Linux continue to use system-only protection. Power plans are never edited.
- Native startup is bounded to 10 seconds; experimental mouse initialization
  is bounded to 20 seconds and releases its helper if that deadline is missed.
- No model/token/tool polling, transcript watcher, or IPC service is needed.
- Native backend readiness on macOS/Linux currently uses process survival,
  not a proven native assertion; the UI must say Unverified rather than green.

Sleep requests cannot override every OS policy, forced shutdown, or explicit
sleep action. On Linux, a logind block inhibitor can also affect lid/power-button
suspend. Linux permission/session behavior still needs native validation.

### Windows Modern Standby and the reported idle failure

The earlier system-only build acknowledged a request while this laptop still
entered Modern Standby at its three-minute idle timeout. Checking acknowledgement
bits was not sufficient proof of unattended protection.

The corrected Windows route requests **both system and display activity**.
The screen-on tradeoff is explicit: use AC power for dependable long runs.
Windows battery policy, lid/power-button sleep, explicit Sleep, and company
policies can still override requests. The extension does not bypass lock
screens, simulate input, change registry/power-plan policy, or need admin rights.
Green indicates an acknowledged live request, not immunity to forced OS actions.

The native idle test below additionally checks actual Kernel-Power sleep/
Modern Standby events and the measured last-input interval beyond the existing
idle policy. Input during the test makes it inconclusive, not a passed soak.

## Local testing and UAT

```sh
npm run typecheck
npm test
npm run test:os
npm run test:integration
```

There is an opt-in **controlled-editor hardware component check** on Windows:

```sh
npm run test:idle:windows
```

It launches a disposable VS Code profile, verifies the candidate's loaded
version and actual cup command binding, and takes the hold only through its
production coordinator. A separate read-only observer creates no inhibitor.
It requires PowerShell 7, AC power, finite existing idle policies, and at least
240 seconds of genuine input inactivity. It never edits those policies.
Successful completion also checks editor-close cleanup.

This controlled editor is **not the affected work window** and is not native
chat Auto or publication approval. The affected-window check uses
[observe-window-windows.ps1](test/os/observe-window-windows.ps1) with the actual window's own extension log
and explicitly expected loaded version. Do not infer that version from the
installed Extensions list.

The observer records changes to the OS's last-input timestamp, not keyboard
characters or mouse positions. Repeated timestamp changes can originate from
automated activity as well as a person; their source is not inferred. Such
activity keeps the result inconclusive. Do not disable unrelated software,
inject input, or weaken the idle threshold to manufacture a pass.

For a real unattended Windows test on AC power:

```powershell
.\test\os\verify-idle-windows.ps1 -Seconds 240
```

To allow a bounded wait for four minutes of genuine no-input time, use
`-WaitForIdleSeconds 600`. The test records the protected interval, measured
idle time, end-of-test AC status, and exact owned-helper release/cleanup times.
It checks real sleep events before classifying a power-source change as
inconclusive, so standby evidence cannot be hidden by that change.

The test must exceed the machine's current finite sleep/display idle timeouts.
It makes no power-plan changes, injects no input, checks for sleep/Modern
Standby events, and releases only its own helper afterward. It requires
PowerShell 7 and Node, and is not a guarantee for battery or forced-sleep policy.

Integration tests run the actual power-control commands in a separate VS Code
profile. They check native holds, Off, timed/no-expiry behavior, settings,
rapid transitions, truthful unavailable Auto, failures and editor shutdown.
No model is invoked. These are **not** evidence that native Copilot Auto or
the unattended laptop sleep problem has passed UAT.
Unit tests have a 5-second per-test deadline. Integration runs have an 8-minute
watchdog (`VSCODE_TEST_RUN_TIMEOUT_MS` can override it for CI or timeout
verification). Failure cleanup targets only that runner's descendants and
recorded helper PIDs with matching process-birth identities. Windows runs with
an existing system/display power hold fail as **inconclusive**, not as passed
acquire/release verification.

For a focused native regression, `VSCODE_TEST_NAME` accepts literal case-name
fragments separated by `|`. Unselected cases are reported as not run, never
passing. The editor-shutdown ownership case still runs. This filter does not
change any assertion, per-case timeout or hardware-idle threshold.

For Windows UAT, click the actual ready cup. Verify the green
cup and confirmed Manual tooltip. Continue your normal prompt; click again when
done and verify the neutral ready label returns with no owned helper.
Check explicit timed expiry and the 0-hour no-expiry choice separately.
Auto must remain clearly unavailable and must not silently stop an active
Manual hold. Opening the editor without clicking the control must stay inactive.

Installing an update does not replace the handler in an already-running window.
If clicking a ready cup only shows the old scope message, that window is using
the earlier build. Use **Developer: Reload Window** when its agent work is done.
The extension's own log records the loaded version so this can be verified,
rather than guessing from the installed Extensions list.

### Independent extensions, shared VS Code host

Agent Awake has no dependency on AI Credits Usage Tracker and never
activates, refreshes, or restarts it. Their commands, settings, and owned
helpers/workers are separate. Agent Awake's Off stops its own power ownership;
it does not reload VS Code or another extension.

**Developer: Reload Window** and **Developer: Restart Extension Host** are
VS Code-wide lifecycle actions for that window. They restart the shared
extension host and consequently reload other enabled extensions, including
AI Credits. They are not a restart of Agent Awake alone. The same shared-host
boundary means a host crash can affect both; independent features do not
imply separate crash-isolated extension-host processes.

For ordinary use, click the coffee control to turn it **On** or **Off**;
no reload is needed. Reserve a window reload for loading an installed update,
and do it when active agent work is safe to interrupt.

Native macOS/Linux tests are still required before claiming validated support.
Linux OS verification uses `busctl` JSON output from logind's `ListInhibitors`
in `what, who, why, mode, uid, pid` order. It requires JSON-capable `busctl` and
a reachable logind system bus; malformed or failed queries fail the tests.

## Native Auto evidence gates

Official Local/Copilot hooks are legitimate integration routes; they are not
universally unusable. Before Auto can be offered as working protection, its
specific harness must prove request start, final end/cancellation, failure,
blocked Stop/continuation, silent work, overlap, child ownership and routing
to the correct local window. A repository path or optional session ID alone
does not establish that routing.

The Local `Stop` event explicitly means **about to stop**, not inactive.
Copilot's `agentStop` can also block and force continuation. No short
silence timeout or arbitrary file activity is used as a substitute.
The verified profile, metadata-only transport and real native UAT remain
prerequisites, not shipped features.

Sources:
[Local hooks reference](https://code.visualstudio.com/docs/agents/reference/hooks-reference),
[Copilot hooks reference](https://docs.github.com/en/copilot/reference/hooks-reference),
[VS Code extension hosts](https://code.visualstudio.com/api/advanced-topics/extension-host).

## Validation scope and version checks

Windows native command/request and cleanup checks pass, including the actual
cup's command binding, timed expiry, failure/retry, and editor exit. The genuine
unattended hardware test remains **inconclusive** because input continued during
the measured intervals. This release does not claim that the reported laptop
sleep problem has passed unattended UAT or that OS policies can be overridden.
Native Copilot Auto and macOS/Linux confirmation remain separately unverified.

Local source, an installed VSIX, a loaded window and the Marketplace version are
distinct. Public distribution is withdrawn pending real idle acceptance and
explicit approval. After an update, reload a window only when its agent
work is safe to interrupt, then use **Agent Awake: Show Log** to check the loaded
version. Reload starts Off; click the cup to enable it again.

CI tests are manually triggered. There is no automatic Marketplace release
workflow. The usage/why source is in this repository's `docs` folder, but its
Pages deployment is disabled while validation is incomplete.

License: [MIT](LICENSE).

Windows references:
[SetThreadExecutionState](https://learn.microsoft.com/windows/win32/api/winbase/nf-winbase-setthreadexecutionstate),
[power-request limits](https://learn.microsoft.com/windows/win32/api/winbase/nf-winbase-powersetrequest).
