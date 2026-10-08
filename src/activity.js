// @ts-check
'use strict';

/**
 * Decides whether "something is happening" for activity mode.
 *
 * Active while any long-running work is in progress (terminal commands, tasks) and for
 * `timeoutMs` after the most recent burst of activity. Recording activity is O(1) and does
 * not touch timers while already active; at most one timer exists at any time.
 */
class ActivityTracker {
  /**
   * @param {object} options
   * @param {number} options.timeoutMs
   * @param {(active: boolean) => void} options.onChange
   * @param {() => number} [options.now]
   * @param {typeof setTimeout} [options.setTimer]
   * @param {typeof clearTimeout} [options.clearTimer]
   */
  constructor(options) {
    this._timeoutMs = Math.max(1, options.timeoutMs);
    this._onChange = options.onChange;
    this._now = options.now || Date.now;
    this._setTimer = options.setTimer || setTimeout;
    this._clearTimer = options.clearTimer || clearTimeout;
    /** @type {number | undefined} */
    this._last = undefined;
    /** @type {Set<unknown>} */
    this._busy = new Set();
    /** @type {ReturnType<typeof setTimeout> | undefined} */
    this._timer = undefined;
    this._active = false;
    this._disposed = false;
  }

  get active() { return this._active; }

  /** Number of long-running operations in progress. */
  get busyCount() { return this._busy.size; }

  /** Time of the most recent activity (ms since epoch), if any. */
  get lastActivity() { return this._last; }

  get timeoutMs() { return this._timeoutMs; }

  /** Records a moment of activity. */
  poke() {
    if (this._disposed) {
      return;
    }
    this._last = this._now();
    if (!this._active) {
      this._active = true;
      this._arm(this._timeoutMs);
      this._onChange(true);
    } else if (this._timer === undefined && this._busy.size === 0) {
      this._arm(this._timeoutMs);
    }
  }

  /**
   * Marks the start of long-running work; stays active until {@link end} is called with the same key.
   * @param {unknown} key
   */
  begin(key) {
    this._busy.add(key);
    this.poke();
  }

  /**
   * Marks long-running work as finished. The timeout restarts from now. Unknown keys are ignored.
   * @param {unknown} key
   */
  end(key) {
    if (this._busy.delete(key)) {
      this.poke();
    }
  }

  /** @param {number} ms */
  setTimeoutMs(ms) {
    this._timeoutMs = Math.max(1, ms);
    if (this._active) {
      this._arm(0);
    }
  }

  dispose() {
    this._disposed = true;
    this._disarm();
    this._busy.clear();
  }

  /** @param {number} delay */
  _arm(delay) {
    this._disarm();
    this._timer = this._setTimer(() => this._check(), delay);
  }

  _disarm() {
    if (this._timer !== undefined) {
      this._clearTimer(this._timer);
      this._timer = undefined;
    }
  }

  _check() {
    this._timer = undefined;
    if (this._disposed || !this._active) {
      return;
    }
    if (this._busy.size > 0) {
      return; // end() pokes and re-arms the timer when the work finishes.
    }
    const remaining = (this._last ?? 0) + this._timeoutMs - this._now();
    if (remaining > 0) {
      this._arm(remaining);
      return;
    }
    this._active = false;
    this._onChange(false);
  }
}

module.exports = { ActivityTracker };
