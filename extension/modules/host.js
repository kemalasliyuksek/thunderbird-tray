// SPDX-License-Identifier: MIT

export const HOST_NAME = "com.kemalasliyuksek.thunderbird_tray";

const FIRST_RETRY_MS = 2_000;
const MAX_RETRY_MS = 60_000;

/**
 * Keeps a native messaging connection to the tray program, reconnecting with
 * a growing delay when it is missing or exits.
 *
 * The connection counts as up only once the program says "ready", because
 * connectNative() never fails synchronously: a missing program shows up as
 * an immediate disconnect.
 */
export class HostConnection {
  constructor({
    connect,
    onReady,
    onMessage,
    onLost,
    // Wrapped, because timer functions throw when called as a method of another object.
    setTimer = (callback, delay) => setTimeout(callback, delay),
    clearTimer = timer => clearTimeout(timer),
    log = console,
  }) {
    this.connect = connect;
    this.onReady = onReady;
    this.onMessage = onMessage;
    this.onLost = onLost;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.log = log;
    this.port = null;
    this.ready = false;
    this.retryMs = FIRST_RETRY_MS;
    this.timer = null;
    this.stopped = false;
  }

  start() {
    this.stopped = false;
    this.open();
  }

  stop() {
    this.stopped = true;
    this.clearTimer(this.timer);
    this.timer = null;
    const port = this.port;
    this.port = null;
    port?.disconnect();
    this.setLost();
  }

  send(message) {
    if (this.port && this.ready) {
      this.port.postMessage(message);
      return true;
    }
    return false;
  }

  open() {
    this.timer = null;
    let port;
    try {
      port = this.connect(HOST_NAME);
    } catch (error) {
      this.log.warn(`Tray program could not be started: ${error.message}`);
      this.scheduleRetry();
      return;
    }
    this.port = port;
    port.onMessage.addListener(message => {
      if (port != this.port) {
        return;
      }
      if (message?.type == "ready") {
        this.ready = true;
        this.retryMs = FIRST_RETRY_MS;
        this.onReady(message);
      } else if (this.ready) {
        this.onMessage(message);
      }
    });
    port.onDisconnect.addListener(() => {
      if (port != this.port) {
        return;
      }
      const reason = port.error?.message ?? "it exited";
      this.log.warn(`Tray program disconnected: ${reason}`);
      this.port = null;
      this.setLost();
      this.scheduleRetry();
    });
  }

  setLost() {
    if (this.ready) {
      this.ready = false;
      this.onLost();
    }
  }

  scheduleRetry() {
    if (this.stopped || this.timer) {
      return;
    }
    this.timer = this.setTimer(() => this.open(), this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, MAX_RETRY_MS);
  }
}
