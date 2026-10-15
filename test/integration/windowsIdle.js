// @ts-check
'use strict';

if (process.platform !== 'win32') throw new Error('This controlled-editor hardware test requires Windows.');
process.env.VSCODE_TEST_WINDOWS_IDLE = '1';
require('./runTest');
