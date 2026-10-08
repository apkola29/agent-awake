// @ts-check
'use strict';

/**
 * Launches a clean, isolated VS Code (fresh user-data and extensions folders) with this extension
 * loaded and runs ./suite inside its extension host.
 *
 * Environment:
 *   VSCODE_TEST_VERSION  VS Code version to test against ('stable', 'insiders' or e.g. '1.93.0')
 *   VSCODE_TEST_CACHE    where to cache downloaded VS Code builds (default: OS temp folder)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { runTests } = require('@vscode/test-electron');

async function main() {
  const root = path.resolve(__dirname, '..', '..');
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-keep-awake-it-'));
  const workspace = path.join(scratch, 'workspace');
  fs.mkdirSync(workspace);
  fs.writeFileSync(path.join(workspace, 'README.md'), '# scratch workspace for integration tests\n');

  const version = process.env.VSCODE_TEST_VERSION || 'stable';
  console.log(`Running integration tests against VS Code ${version}`);
  try {
    await runTests({
      version,
      cachePath: process.env.VSCODE_TEST_CACHE || path.join(os.tmpdir(), 'agent-keep-awake-vscode-test'),
      extensionDevelopmentPath: root,
      extensionTestsPath: path.join(__dirname, 'suite', 'index.js'),
      extensionTestsEnv: { AKA_TEST_WORKSPACE: workspace },
      launchArgs: [
        workspace,
        '--user-data-dir', path.join(scratch, 'user-data'),
        '--extensions-dir', path.join(scratch, 'extensions'),
        '--disable-extensions',
        '--disable-workspace-trust',
        '--skip-welcome',
        '--skip-release-notes'
      ]
    });
  } finally {
    try {
      fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    } catch {
      /* best effort; VS Code may still hold files on Windows */
    }
  }
}

main().catch(err => {
  console.error('Integration tests failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
