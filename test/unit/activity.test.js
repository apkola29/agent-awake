// @ts-check
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { ActivityTracker } = require('../../src/activity');
const { createClock } = require('./helpers');

function setup(timeoutMs = 60_000) {
  const clock = createClock();
  /** @type {boolean[]} */
  const changes = [];
  const tracker = new ActivityTracker({
    timeoutMs,
    onChange: active => changes.push(active),
    now: clock.now,
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer
  });
  return { tracker, clock, changes };
}

test('starts idle', () => {
  const { tracker, clock } = setup();
  assert.equal(tracker.active, false);
  assert.equal(clock.pending(), 0);
});

test('activity turns it on, and it turns off after the timeout', () => {
  const { tracker, clock, changes } = setup();
  tracker.poke();
  assert.equal(tracker.active, true);
  assert.deepEqual(changes, [true]);
  clock.advance(59_999);
  assert.equal(tracker.active, true);
  clock.advance(1);
  assert.equal(tracker.active, false);
  assert.deepEqual(changes, [true, false]);
  assert.equal(clock.pending(), 0, 'no timers while idle');
});

test('more activity extends the window without timer churn', () => {
  const { tracker, clock, changes } = setup();
  tracker.poke();
  const armed = clock.setTimerCalls;
  for (let i = 0; i < 1000; i++) {
    clock.advance(30);
    tracker.poke();
  }
  assert.equal(clock.setTimerCalls, armed, '1000 events, zero extra timers');
  clock.advance(59_999);
  assert.equal(tracker.active, true, 'still within timeout of the last event');
  clock.advance(1);
  assert.equal(tracker.active, false);
  assert.deepEqual(changes, [true, false]);
});

test('long-running work keeps it active past the timeout', () => {
  const { tracker, clock, changes } = setup();
  tracker.begin('build');
  clock.advance(10 * 60_000);
  assert.equal(tracker.active, true);
  assert.equal(tracker.busyCount, 1);
  tracker.end('build');
  assert.equal(tracker.busyCount, 0);
  clock.advance(59_999);
  assert.equal(tracker.active, true, 'timeout restarts when the work ends');
  clock.advance(1);
  assert.equal(tracker.active, false);
  assert.deepEqual(changes, [true, false]);
});

test('overlapping work items are tracked independently', () => {
  const { tracker, clock } = setup();
  tracker.begin('a');
  tracker.begin('b');
  tracker.end('a');
  clock.advance(5 * 60_000);
  assert.equal(tracker.active, true, 'b still running');
  tracker.end('b');
  clock.advance(60_000);
  assert.equal(tracker.active, false);
});

test('ending unknown work is ignored', () => {
  const { tracker, changes } = setup();
  tracker.end('never-started');
  assert.equal(tracker.active, false);
  assert.deepEqual(changes, []);
});

test('shortening the timeout applies immediately', () => {
  const { tracker, clock } = setup(30 * 60_000);
  tracker.poke();
  clock.advance(5 * 60_000);
  tracker.setTimeoutMs(60_000);
  clock.advance(0);
  assert.equal(tracker.active, false);
  assert.equal(tracker.timeoutMs, 60_000);
});

test('lengthening the timeout keeps it active longer', () => {
  const { tracker, clock } = setup(60_000);
  tracker.poke();
  tracker.setTimeoutMs(5 * 60_000);
  clock.advance(4 * 60_000);
  assert.equal(tracker.active, true);
  clock.advance(60_000);
  assert.equal(tracker.active, false);
});

test('can become active again after going idle', () => {
  const { tracker, clock, changes } = setup();
  tracker.poke();
  clock.advance(60_000);
  tracker.poke();
  assert.deepEqual(changes, [true, false, true]);
});

test('dispose clears timers and silences callbacks', () => {
  const { tracker, clock, changes } = setup();
  tracker.poke();
  tracker.dispose();
  assert.equal(clock.pending(), 0);
  clock.advance(10 * 60_000);
  tracker.poke();
  assert.deepEqual(changes, [true]);
});

test('timeout is clamped to at least 1ms', () => {
  const { tracker } = setup(0);
  assert.equal(tracker.timeoutMs, 1);
});
