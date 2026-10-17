# Changelog

## Unreleased local prototype - 1.3.0

- Add a separate, per-session consent-gated Windows mouse-jiggle command.
  Native power requests remain the default and the ordinary cup never
  silently opts into simulated input.
- Reuse the sole coordinator, duration/expiry and EOF cleanup. One persistent
  helper waits 30 seconds between guarded checks, skips recent/held input,
  stops on lock/session change, and never auto-restarts after failure.
- Keep input-only sessions visibly Unverified and separate from native
  request acknowledgement. Disclose pointer/automatic-lock effects.
- No live synthetic input is run by the automated startup/policy tests.
  This prototype is not installed or published, not benchmarked as lighter,
  and not certified to prevent sleep. Public distribution remains withdrawn.
- Exercise the production pulse and allocation path through a non-native stub:
  16 cases cover input-buffer layout, recent/held input, lock/session changes,
  cancellation, API rejection and clock wrap. No live mouse API is called.
- Stop visibly on unusable last-input timestamps rather than silently skipping
  indefinitely. This is a fail-closed guard, not a verified sleep fix.
- Refuse the experimental input command in automated extension-test hosts,
  verified separately from manually consented development/normal windows.

## Unreleased local development - 1.2.3

- Show the version actually loaded in this window in the tooltip, screen-reader
  label and Show Status, rather than making users infer it from installed files.
- Replace absolute stays-awake assurances with native-request acknowledgement
  and an explicit statement that it is not unattended sleep-prevention proof.
- Clarify that chat activity does not activate this manual prototype.
- These disclosure fixes do not fix or certify hardware sleep prevention.
  No 1.2.3 package, installation, public push or deployment is authorized.
- Add an opt-in controlled-editor hardware component checker using the actual
  production coordinator plus a read-only native observer. It verifies loaded
  version and helper/host identity, unchanged idle policies and real sleep
  events; records input-timestamp changes without input contents. It is not
  affected-work-window acceptance, native Auto evidence or publication approval.
- Require both native last-input age and an independently observed monotonic
  quiet interval to meet the exact idle threshold. Sample last input before
  current time to avoid a newly arriving event producing unsigned underflow.
  These are diagnostic acceptance safeguards, not changes to power protection.

## 1.2.2 distribution withdrawn - 2026-10-14

- Withdraw the GitHub binary release and Pages site, and unpublish the
  Marketplace listing after the reported sleep failure. Preserve source/history.
- Native API/command checks were not sufficient unattended hardware acceptance.
  Installed-version checks also failed to establish the version actually loaded
  in the affected window. Do not promote the prototype as a verified fix.
- Further publication requires a real idle test on the actual loaded build
  and explicit approval. Native chat Auto remains unavailable.

## 1.2.2 - Agent Awake public distribution

- Prepare the tested manual-control runtime for the Agent Awake public update,
  preserving the original Marketplace ID for in-place upgrades.
- Publish a coherent install/update guide, why/usage pages and control-only
  screenshot illustrations, without surrounding chat/model context.
- Keep the 1.2.1 runtime unchanged. Windows native command/request and cleanup
  checks pass; unattended hardware UAT remains inconclusive, not certified.
  Automatic native chat detection is still unavailable.

## 1.2.1 - common Off guard

- A direct green-cup click always releases protection, including a future
  verified Auto hold, rather than silently replacing it with indefinite Manual.
- Add rapid ready-cup click coverage proving a cancelled startup cannot turn
  green later. Native Copilot Auto remains unavailable in production.
- Reconcile the usage guide and site with direct clicking, default-until-off,
  the 1/2/4/8-hour choices, and the Agent Awake name. Include control-only UI
  illustrations without surrounding chat context.
- Record protected idle-test intervals and helper release times. Check real
  sleep events before AC/input inconclusive results can mask them.

## 1.2.0 - Agent Awake working-control correction

- Rename the display name, command category and output channel to Agent Awake,
  while preserving `apkola29.agent-keep-awake` for in-place upgrades.
- Wire the actual ready/green status-bar cup to direct session on/off instead
  of opening a mode picker. No model or special chat prefix is required.
- Default to no expiry (`durationHours = 0`), with explicit 1, 2, 4 and 8-hour
  choices and configurable durations up to 24 hours.
- Preserve combined Windows system/display requests and truthful startup,
  failure and unverified-platform states; old system-only 1.0.4 must not be
  relied on for unattended Modern Standby.
- Add test-first direct visible-command/default-no-expiry regressions and keep
  one-hour acceptance cases explicit rather than relying on an old default.
- Native Copilot Auto is still unavailable. Device lock, lid, battery and
  forced-sleep policies are not bypassed or represented as guaranteed protection.

## 1.1.0 - manual-mode and owner-coordinator preview

- Adopt the implementation handoff's Off / Keep awake / Auto mode controls.
- Keep awake means indefinite manual ownership until Off or owning-window exit;
  preserve explicitly timed commands and Duration (Hours), including 0/no expiry.
- Consolidate desired protection behind one idempotent owner-map coordinator
  with instance/generation boundaries, stale-event rejection and bounded timers.
- Off releases only this extension's holds and does not cancel native Copilot.
- Remove the @awake participant/model/tool route from the packaged runtime.
  Its historical tests remain in the development repository, not native Auto evidence.
- Native Copilot Auto stays visibly Unavailable until a complete harness-specific
  lifecycle/correlation profile passes; no live hooks or IPC service are installed.
- Retain combined Windows system/display requests, explicit screen-on/AC
  limitations, and unverified non-Windows readiness rather than false green.
- Native Windows verification now refuses ambient system/display power holds
  as inconclusive before starting a test helper.
- Originally packaged for local review. An existing Marketplace listing later
  reported 1.1.0; local packaging alone did not establish publication or the
  version loaded in an already-running window.

## 1.0.5 - unpublished duration settings and Windows standby correction

- Added application-scoped Duration (Hours), default 1, configurable through extension settings.
- Added 0-hour live-forever mode with no expiry timer; still stops on Off,
  window close/reload, or helper failure. Positive durations support up to 24 hours.
- Settings changes affect the next click, never silently alter an active session.
- Validate numeric/fractional durations and keep invalid settings from starting a helper.
- Correct Windows activation to request display activity along with system activity.
  A real idle Modern Standby event was reported despite the earlier system-only request.
- Windows screen-on behavior, AC recommendation, and forced/battery-policy limits
  are explicit in the tooltip and guide; no input simulation or power-plan changes.
- Added test-first settings/no-expiry/display regressions and a native unattended
  idle test that checks real standby events beyond the machine's current timeout.
- Hardened optional @awake context with encoded untrusted data and fresh,
  fail-closed approval of every tool's bounded arguments; preserved native confirmations.
- Explicitly request response-stream closure on cancellation without waiting on
  uncooperative providers; no power ownership remains for a cancelled request.
- Removed prompt/context identity/raw provider-error persistence from extension logs.
- Added security regression tests, late-approval cancellation checks, and 500-cycle
  timer/listener cleanup coverage. Third-party provider/tool lifetime remains outside scope.

## 1.0.4 - unpublished compact coffee status

- Inactive: neutral coffee cup with "@awake ready"; tooltip says awake mode is disabled.
- Active: only the green cup remains, freeing status-bar width for adjacent icons.
- Preserve one-click timed activation; accessible labels and tooltips announce enabled/disabled state.
- Log the loaded version to distinguish installed updates from stale running-window handlers.
- Diagnose the reported non-working click: that window was still running the earlier 1.0.1 status-only handler.

## 1.0.3 - unpublished one-click coffee control

- Click once in the lower status bar to enable a 1-hour keep-awake session;
  click again to disable it, with no duration picker or success dialog.
- Added the requested "Awake mode is disabled/enabled" tooltip wording.
- Kept alternate durations in a separate Command Palette action.
- Added test-first no-picker tooltip checks and a real native-power command-toggle check.

## 1.0.2 - unpublished friendly coffee control

- Added explicit timed start/stop sessions for normal Copilot and Claude prompts;
  no special participant or model account is needed for the coffee control.
- Replaced ambiguous "@awake ready" with neutral Off, Starting, green On, and Failed.
- Green uses the theme's success color and appears only after the OS helper
  acknowledges protection; the text and accessible label also say On.
- Added 30-minute, 1-hour, 2-hour, and 4-hour choices. A session stops on expiry,
  coffee click, or window close, never starts merely because VS Code is open.
- Preserved optional @awake automatic request protection with shared-helper ownership.
- Clearly explains that normal chat completion/cancellation does not stop the timer.
- Added test-first timed-session, green-status, startup, failure, expiry, and mixed-mode tests.

## 1.0.1 - unpublished local @awake preview

- Added a supported `@awake` participant inside Copilot Chat using the selected model.
- Automatically hold system protection across its model requests and explicitly
  attached awaited tools; release on completion, error, cancellation, and shutdown.
- Share a helper across overlapping requests, and abort visibly if protection is lost.
- Use only stable APIs; require desktop VS Code 1.95 or newer and a trusted workspace.
- Added test-first request, cancellation, overlap, tool, budget, and disposal regressions.
- Added actual registered-handler integration checks with deterministic models,
  a real VS Code tool, native OS measurements, and editor-shutdown verification.
- Keep ordinary Copilot requests, standalone Claude chats, and detached work outside scope.
- Preserve the no-login, no-telemetry, no-idle-helper contract. Model providers retain
  their own normal sign-in, consent, plan, and usage requirements.
- No GitHub or Marketplace publication; local user UAT approval is still required.

## Earlier unreleased diagnostic prototype

- Withdrew the prematurely published prototype and GitHub Pages site.
- Removed editor-open and generic activity modes. Old settings cannot turn them on.
- Reports unavailable chat integration explicitly; does not make any power request.
- No transcript monitoring, undocumented API access, or manual fallback.
- Added startup and manifest regression tests before implementation.
- Fixed backend reentrant release/acquire/dispose leaks after reproducing them in tests.
- Removed automatic release and push-triggered workflows.
- Provider-wide automatic lifecycle integration was blocked; the supported
  participant-based preview above does not claim to solve interception of other chats.
