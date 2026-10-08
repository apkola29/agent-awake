# Agent Keep-Awake

**Stops your computer from going to sleep while AI agents work in VS Code.**

You start a long agent run (Copilot agent mode, Claude Code, Codex, a swarm of subagents) and walk away. Thirty minutes later your laptop decides nobody is there and goes to sleep. The agent freezes halfway through. Agent Keep-Awake prevents that.

- **No fuss.** Install it and you're done. A coffee cup in the status bar shows it's working; click it to turn it off.
- **Ultra lightweight.** No runtime dependencies. It never polls; the helper process just waits, using about 0% CPU and a few MB of memory.
- **Safe.** It never changes your power settings, never moves your mouse, and doesn't stop your screen from locking. If VS Code quits or crashes, the block goes away with it.
- **Works everywhere.** Windows, macOS and Linux. Works the same in Remote-SSH, WSL and Dev Containers, where it keeps *your* machine awake.

[Why this exists](https://apkola29.github.io/agent-keep-awake/) · [Usage guide](https://apkola29.github.io/agent-keep-awake/usage.html) · [Changelog](CHANGELOG.md)

## Install

1. Download `agent-keep-awake-<version>.vsix` from the [latest release](https://github.com/apkola29/agent-keep-awake/releases/latest).
2. Install it:
   - **Command line:** `code --install-extension agent-keep-awake-1.0.0.vsix`
   - **Or in VS Code:** Extensions view → `...` menu → **Install from VSIX...**

This also works in Cursor, Windsurf, VSCodium and other VS Code-based editors (version 1.93 or newer).

## Use

There's nothing to set up. After install you'll see a cup in the status bar (bottom right):

| Status bar | Meaning |
|---|---|
| `☕` cup | Your computer is being kept awake. |
| Dimmed `☕` cup | *Activity mode* only: watching for activity. Sleep is allowed until something happens. |
| `⊘` slashed circle | Turned off. Your computer sleeps normally. |
| `⚠` warning | Something stopped it from working. Click for details. |

Click the cup to turn it off or on. Hover over it for details.

**Commands** (`Ctrl+Shift+P` / `Cmd+Shift+P`, then type *Agent Keep-Awake*): **Toggle On/Off**, **Turn On**, **Turn Off (Allow Sleep)**, **Show Status**, **Show Log**.

## Settings

| Setting | Default | What it does |
|---|---|---|
| `agentKeepAwake.enabled` | `true` | Main switch. Clicking the cup changes this. |
| `agentKeepAwake.mode` | `"always"` | `always`: stay awake the whole time VS Code is open. `activity`: stay awake only while something is happening (see below). |
| `agentKeepAwake.activityTimeoutMinutes` | `30` | In `activity` mode, how long to stay awake after the last activity. |
| `agentKeepAwake.keepDisplayOn` | `false` | Also keep the screen on. By default the screen can still turn off and lock while the computer keeps running. |
| `agentKeepAwake.showStatusBarItem` | `true` | Show the cup in the status bar. |

**Activity mode** suits people who leave VS Code open all day and want the laptop to sleep once the agents are done. The computer stays awake while any of these is happening, and for `activityTimeoutMinutes` afterwards:

- a file or document is edited, including by an agent or a CLI tool;
- a terminal command is running;
- a task or debug session is running.

## Good to know

- **Closing the lid or pressing the power button still puts the computer to sleep.** That's your explicit choice, and it's respected. To keep working with the lid closed, change your OS lid setting or use an external display.
- **Your screen still locks.** Only the system is kept awake, not the display, unless you turn on `keepDisplayOn`.
- **Several VS Code windows** each hold their own request. The computer stays awake until the last one lets go.
- **On battery** the computer keeps running too, so plug in for long runs.

## How it works

Each OS has a supported way to say "don't sleep right now". Agent Keep-Awake asks for it through a tiny helper that ships with your OS. Nothing is downloaded or compiled, and no settings are written.

| OS | Mechanism | See it yourself |
|---|---|---|
| Windows | `SetThreadExecutionState(ES_CONTINUOUS \| ES_SYSTEM_REQUIRED)`, called from the built-in Windows PowerShell | `powercfg /requests` (admin) |
| macOS | `/usr/bin/caffeinate -i -w <VS Code pid>` | `pmset -g assertions` |
| Linux | `systemd-inhibit --what=sleep` (logind, KDE…) and `gnome-session-inhibit --inhibit suspend` (GNOME) | `systemd-inhibit --list` |

The helper waits on its input pipe (or, with `caffeinate -w`, on the VS Code process itself). If VS Code exits or crashes, the helper exits too, and the OS drops the request. CI checks this on all three OSes by killing the owning process.

## Remote development

The extension runs on your **local** machine by default, even in Remote-SSH, WSL and Dev Containers, because that's the laptop that would fall asleep. If you use VS Code in a browser (for example through a Remote Tunnel), it runs on the remote machine instead and keeps that machine awake.

To keep the remote machine awake rather than your local one, add this to your settings:

```json
"remote.extensionKind": { "apkola29.agent-keep-awake": ["workspace"] }
```

## Troubleshooting

- **Warning icon:** click it, or run **Agent Keep-Awake: Show Log**, to see why.
- **Windows, "Constrained Language Mode":** your organisation has locked down PowerShell, and that blocks the power API call. Ask IT, or use their approved keep-awake tool.
- **Linux:** needs `systemd-inhibit` (systemd) or `gnome-session-inhibit` (GNOME). Desktops that use neither are not supported yet.

## Development

```sh
npm install
npm run typecheck        # strict type-check of the JavaScript sources
npm test                 # unit tests (node:test)
npm run test:os          # real OS verification: holds a request, checks the OS sees it, crash-tests cleanup
npm run test:integration # runs inside a downloaded, isolated VS Code
npm run package          # builds the .vsix
```

## License

[MIT](LICENSE)
