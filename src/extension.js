// @ts-check
'use strict';

const vscode = require('vscode');
const { KeepAwake } = require('./keepAwake');
const { ActivityTracker } = require('./activity');

/** @typedef {InstanceType<typeof KeepAwake>} Backend */
/** @typedef {InstanceType<typeof ActivityTracker>} Tracker */

const SECTION = 'agentKeepAwake';
const MINUTE = 60_000;

/** Document schemes that change on their own (logs, output panels, SCM views) and say nothing about agents. */
const IGNORED_SCHEMES = new Set(['output', 'debug', 'vscode-terminal', 'git', 'gitfs', 'vscode-scm', 'comment', 'walkThroughSnippet']);
const GIT_DIR = /(^|\/)\.git(\/|$)/;

/**
 * @typedef {object} Config
 * @property {boolean} enabled
 * @property {'always' | 'activity'} mode
 * @property {number} timeoutMs
 * @property {boolean} keepDisplayOn
 * @property {boolean} showStatusBar
 */

/** @type {Backend | undefined} */
let backend;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  const log = vscode.window.createOutputChannel('Agent Keep-Awake', { log: true });
  const ka = new KeepAwake({ log: (level, message) => log[level](message) });
  backend = ka;
  const status = vscode.window.createStatusBarItem('agentKeepAwake.status', vscode.StatusBarAlignment.Right, 100);
  status.name = 'Agent Keep-Awake';

  const runsRemotely = Boolean(vscode.env.remoteName) && context.extension.extensionKind === vscode.ExtensionKind.Workspace;
  const machine = runsRemotely ? `the remote machine (${vscode.env.remoteName})` : 'this computer';
  log.info(`Agent Keep-Awake ${context.extension.packageJSON.version} on ${process.platform}/${process.arch}, extension host pid ${process.pid}, keeping ${machine} awake.`);

  /** @type {Tracker | undefined} */
  let tracker;
  /** @type {vscode.Disposable[]} */
  let activitySources = [];
  /** @type {number | undefined} */
  let testTimeoutOverrideMs;
  let lastNotifiedError = '';

  /** @returns {Config} */
  function readConfig() {
    const c = vscode.workspace.getConfiguration(SECTION);
    let minutes = Number(c.get('activityTimeoutMinutes'));
    if (!Number.isFinite(minutes)) {
      minutes = 30;
    }
    minutes = Math.min(Math.max(minutes, 1), 1440);
    return {
      enabled: c.get('enabled') !== false,
      mode: c.get('mode') === 'activity' ? 'activity' : 'always',
      timeoutMs: testTimeoutOverrideMs ?? minutes * MINUTE,
      keepDisplayOn: c.get('keepDisplayOn') === true,
      showStatusBar: c.get('showStatusBarItem') !== false
    };
  }

  /** @param {Tracker} t */
  function startActivitySources(t) {
    const poke = () => t.poke();
    /** @type {vscode.Disposable[]} */
    const d = [];
    d.push(vscode.workspace.onDidChangeTextDocument(e => {
      if (e.contentChanges.length > 0 && !IGNORED_SCHEMES.has(e.document.uri.scheme)) {
        t.poke();
      }
    }));
    d.push(vscode.workspace.onDidChangeNotebookDocument(poke));

    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    const onFile = (/** @type {vscode.Uri} */ uri) => {
      if (!GIT_DIR.test(uri.path)) {
        t.poke();
      }
    };
    d.push(watcher, watcher.onDidCreate(onFile), watcher.onDidChange(onFile), watcher.onDidDelete(onFile));

    // Terminal commands (agents run builds/tests here; CLI agents such as Claude Code run here too).
    /** @type {Map<vscode.TerminalShellExecution, vscode.Terminal>} */
    const running = new Map();
    const w = vscode.window;
    if (typeof w.onDidStartTerminalShellExecution === 'function') {
      d.push(w.onDidStartTerminalShellExecution(e => { running.set(e.execution, e.terminal); t.begin(e.execution); }));
      d.push(w.onDidEndTerminalShellExecution(e => { running.delete(e.execution); t.end(e.execution); }));
      d.push(w.onDidCloseTerminal(term => {
        for (const [execution, owner] of running) {
          if (owner === term) {
            running.delete(execution);
            t.end(execution);
          }
        }
      }));
    }

    // Tasks and debug sessions. Background (watch) tasks run forever, so they only count when they start.
    const startTask = (/** @type {vscode.TaskExecution} */ execution) => {
      if (execution.task.isBackground) {
        t.poke();
      } else {
        t.begin(execution);
      }
    };
    vscode.tasks.taskExecutions.forEach(startTask);
    d.push(vscode.tasks.onDidStartTask(e => startTask(e.execution)));
    d.push(vscode.tasks.onDidEndTask(e => t.end(e.execution)));
    d.push(vscode.debug.onDidStartDebugSession(s => t.begin(s)));
    d.push(vscode.debug.onDidTerminateDebugSession(s => t.end(s)));
    return d;
  }

  function stopActivitySources() {
    activitySources.forEach(d => d.dispose());
    activitySources = [];
    tracker?.dispose();
    tracker = undefined;
  }

  /** @param {Config} cfg */
  function syncActivitySources(cfg) {
    const wantActivity = cfg.enabled && cfg.mode === 'activity';
    if (!wantActivity) {
      if (tracker) {
        stopActivitySources();
        log.info('Activity tracking stopped.');
      }
      return;
    }
    if (tracker) {
      if (tracker.timeoutMs !== cfg.timeoutMs) {
        tracker.setTimeoutMs(cfg.timeoutMs);
      }
      return;
    }
    const wasHolding = ka.state === 'on' || ka.state === 'starting';
    tracker = new ActivityTracker({
      timeoutMs: cfg.timeoutMs,
      onChange: active => {
        log.info(active ? 'Activity detected; keeping awake.' : `No activity for ${formatDuration(readConfig().timeoutMs)}; allowing sleep.`);
        update();
      }
    });
    activitySources = startActivitySources(tracker);
    log.info(`Activity tracking started (timeout ${formatDuration(cfg.timeoutMs)}).`);
    if (wasHolding) {
      tracker.poke(); // Switching from "always": keep holding for one timeout instead of dropping immediately.
    }
  }

  function update() {
    const cfg = readConfig();
    syncActivitySources(cfg);
    const wanted = cfg.enabled && (cfg.mode === 'always' || (tracker !== undefined && tracker.active));
    if (wanted) {
      ka.acquire({ display: cfg.keepDisplayOn });
    } else {
      ka.release();
    }
    render(cfg);
  }

  /** @param {Config} [cfg] */
  function render(cfg = readConfig()) {
    if (!cfg.showStatusBar) {
      status.hide();
      return;
    }
    const state = ka.state;
    const lines = [];
    /** @type {vscode.ThemeColor | undefined} */
    let color;
    /** @type {vscode.ThemeColor | undefined} */
    let background;
    let command = `${SECTION}.toggle`;
    if (!cfg.enabled) {
      status.text = '$(circle-slash)';
      lines.push(`**Agent Keep-Awake is off.** ${capitalize(machine)} can sleep normally.`, '', '[Turn on](command:agentKeepAwake.toggle)');
    } else if (state === 'error') {
      status.text = '$(warning)';
      background = new vscode.ThemeColor('statusBarItem.warningBackground');
      command = `${SECTION}.showStatus`;
      lines.push(`**Agent Keep-Awake can't keep ${machine} awake.**`, '', escapeMarkdown(ka.error), '', '[Show log](command:agentKeepAwake.showLog) · [Turn off](command:agentKeepAwake.toggle)');
    } else if (state === 'on' || state === 'starting') {
      status.text = '$(coffee)';
      const why = cfg.mode === 'activity' ? ' while activity continues' : ' while VS Code is open';
      lines.push(`**Keeping ${machine} awake**${why}${state === 'starting' ? ' (starting...)' : ''}.`);
      lines.push('', cfg.keepDisplayOn ? 'The display is kept on too.' : 'The screen can still turn off and lock as usual.');
      lines.push('', '[Turn off](command:agentKeepAwake.toggle) · [Settings](command:agentKeepAwake.openSettings)');
    } else {
      status.text = '$(coffee)';
      color = new vscode.ThemeColor('disabledForeground');
      lines.push(`**Watching for activity.** ${capitalize(machine)} can sleep normally until something happens in this window.`);
      lines.push('', '[Turn off](command:agentKeepAwake.toggle) · [Settings](command:agentKeepAwake.openSettings)');
    }
    const tooltip = new vscode.MarkdownString(lines.join('\n'), true);
    tooltip.isTrusted = { enabledCommands: [`${SECTION}.toggle`, `${SECTION}.showLog`, `${SECTION}.openSettings`] };
    status.tooltip = tooltip;
    status.color = color;
    status.backgroundColor = background;
    status.command = command;
    status.accessibilityInformation = { label: `Agent Keep-Awake: ${describe(cfg, state)}`, role: 'button' };
    status.show();
  }

  /**
   * @param {Config} cfg
   * @param {string} state
   */
  function describe(cfg, state) {
    if (!cfg.enabled) {
      return 'off';
    }
    if (state === 'error') {
      return 'error';
    }
    if (state === 'on' || state === 'starting') {
      return 'keeping awake';
    }
    return 'watching for activity';
  }

  /** @param {boolean} value */
  async function setEnabled(value) {
    const config = vscode.workspace.getConfiguration(SECTION);
    const info = config.inspect('enabled');
    const target = info?.workspaceValue !== undefined ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    if (value) {
      ka.resetFailures();
    }
    try {
      await config.update('enabled', value, target);
    } catch (err) {
      vscode.window.showErrorMessage(`Agent Keep-Awake: could not update the setting: ${err instanceof Error ? err.message : String(err)}`);
    }
    update();
  }

  async function showStatus() {
    const cfg = readConfig();
    const state = ka.state;
    const parts = [`Agent Keep-Awake is ${describe(cfg, state)}.`];
    if (cfg.enabled) {
      parts.push(`Mode: ${cfg.mode}${cfg.mode === 'activity' ? ` (${formatDuration(cfg.timeoutMs)} timeout)` : ''}.`);
      if (state === 'on' || state === 'starting') {
        parts.push(`Using ${ka.activeHelpers.join(' + ') || 'helper (starting)'} on ${process.platform}${cfg.keepDisplayOn ? ', display kept on' : ''}.`);
      }
      if (state === 'error') {
        parts.push(ka.error);
      }
    }
    const toggle = cfg.enabled ? 'Turn Off' : 'Turn On';
    const choice = await vscode.window.showInformationMessage(parts.join(' '), toggle, 'Show Log', 'Settings');
    if (choice === toggle) {
      await setEnabled(!cfg.enabled);
    } else if (choice === 'Show Log') {
      log.show(true);
    } else if (choice === 'Settings') {
      await vscode.commands.executeCommand('workbench.action.openSettings', SECTION);
    }
  }

  ka.on('change', state => {
    log.debug(`Backend state: ${state}`);
    if (state === 'error' && ka.error && ka.error !== lastNotifiedError) {
      lastNotifiedError = ka.error;
      vscode.window.showWarningMessage(`Agent Keep-Awake can't keep ${machine} awake: ${ka.error}`, 'Show Log', 'Turn Off').then(choice => {
        if (choice === 'Show Log') {
          log.show(true);
        } else if (choice === 'Turn Off') {
          setEnabled(false);
        }
      });
    }
    render();
  });

  context.subscriptions.push(
    log,
    status,
    { dispose: () => { stopActivitySources(); ka.dispose(); backend = undefined; } },
    vscode.commands.registerCommand(`${SECTION}.toggle`, () => setEnabled(!readConfig().enabled)),
    vscode.commands.registerCommand(`${SECTION}.enable`, () => setEnabled(true)),
    vscode.commands.registerCommand(`${SECTION}.disable`, () => setEnabled(false)),
    vscode.commands.registerCommand(`${SECTION}.showStatus`, showStatus),
    vscode.commands.registerCommand(`${SECTION}.showLog`, () => log.show(true)),
    vscode.commands.registerCommand(`${SECTION}.openSettings`, () => vscode.commands.executeCommand('workbench.action.openSettings', SECTION)),
    vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration(SECTION)) {
        ka.resetFailures();
        update();
      }
    })
  );

  update();

  // Small API used by the integration tests (and handy for other extensions to query state).
  return {
    getState() {
      const cfg = readConfig();
      return {
        enabled: cfg.enabled,
        mode: cfg.mode,
        keepDisplayOn: cfg.keepDisplayOn,
        backendState: ka.state,
        error: ka.error,
        helpers: ka.activeHelpers,
        pids: ka.pids,
        activityActive: tracker ? tracker.active : false,
        busyCount: tracker ? tracker.busyCount : 0,
        statusText: status.text
      };
    },
    /** @param {number | undefined} ms Overrides the activity timeout (tests only). */
    setActivityTimeoutOverrideMs(ms) {
      testTimeoutOverrideMs = ms;
      update();
    }
  };
}

function deactivate() {
  backend?.dispose();
  backend = undefined;
}

/** @param {number} ms */
function formatDuration(ms) {
  if (ms >= MINUTE && ms % MINUTE === 0) {
    const minutes = ms / MINUTE;
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  return `${Math.round(ms / 1000)} seconds`;
}

/** @param {string} s */
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** @param {string} s */
function escapeMarkdown(s) {
  return s.replace(/[\\`*_{}[\]()#+\-.!|<>]/g, '\\$&');
}

module.exports = { activate, deactivate };
