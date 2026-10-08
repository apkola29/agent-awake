# Changelog

## 1.0.0

First release.

- Keeps the computer from sleeping while VS Code is open (`always` mode, the default).
- Optional `activity` mode: stays awake only while documents or files change, or while terminal commands, tasks or debug sessions run, then for a configurable timeout afterwards.
- Status bar cup with on, watching, off and error states. Click it to toggle.
- Uses OS-provided helpers only: Windows PowerShell (`SetThreadExecutionState`), macOS `caffeinate`, Linux `systemd-inhibit` / `gnome-session-inhibit`.
- The helper exits automatically if VS Code exits or crashes, so no sleep block is left behind.
- If the helper is killed, it restarts with back-off.
- Optional `keepDisplayOn`.
- Runs on the local machine in Remote-SSH, WSL and Dev Containers.
