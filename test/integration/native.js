// @ts-check
'use strict';

const assert = require('node:assert/strict');
const path = require('path');
const { execFile } = require('node:child_process');

/** @param {string} script @param {string} modulePath @param {unknown} value */
async function nodeWorker(script, modulePath, value) {
  const node = process.env.AKA_TEST_NODE;
  assert.ok(node, 'runner supplies an actual Node binary; never spawn another editor');
  const output = await new Promise((resolve, reject) => {
    execFile(node, ['-e', script, modulePath, JSON.stringify(value)],
      { encoding: 'utf8', windowsHide: true, timeout: 65_000 }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout);
      });
  });
  return /** @type {unknown} */ (JSON.parse(output));
}

/** @param {number[]} pids @returns {Promise<import('../os/processes').ProcessIdentity[]>} */
async function identities(pids) {
  const marks = await nodeWorker(
    'console.log(JSON.stringify(JSON.parse(process.argv[2]).map(p=>require(process.argv[1]).identity(p)).filter(Boolean)))',
    path.join(__dirname, '..', 'os', 'processes.js'), pids
  );
  assert.ok(Array.isArray(marks), 'helper identities must be an array');
  /** @type {import('../os/processes').ProcessIdentity[]} */
  const verified = [];
  for (const mark of marks) {
    assert.ok(mark && typeof mark === 'object' && typeof mark.pid === 'number' && pids.includes(mark.pid) &&
      typeof mark.birth === 'string' && mark.birth, 'helper identity must include its process birth marker');
    verified.push({ pid: mark.pid, birth: mark.birth });
  }
  return verified;
}

module.exports = { nodeWorker, identities };
