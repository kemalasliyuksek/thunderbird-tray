import assert from "node:assert/strict";
import { test } from "node:test";

import { HOST_NAME, HostConnection } from "../../extension/modules/host.js";

class FakeEvent {
  listeners = [];
  addListener(listener) {
    this.listeners.push(listener);
  }
  fire(...args) {
    for (const listener of this.listeners) {
      listener(...args);
    }
  }
}

class FakePort {
  onMessage = new FakeEvent();
  onDisconnect = new FakeEvent();
  sent = [];
  disconnected = false;
  error = null;
  postMessage(message) {
    this.sent.push(message);
  }
  disconnect() {
    this.disconnected = true;
  }
}

function setup() {
  const ports = [];
  const timers = [];
  const events = [];
  const connection = new HostConnection({
    connect: name => {
      assert.equal(name, HOST_NAME);
      const port = new FakePort();
      ports.push(port);
      return port;
    },
    onReady: message => events.push(["ready", message]),
    onMessage: message => events.push(["message", message]),
    onLost: () => events.push(["lost"]),
    setTimer: (callback, delay) => {
      timers.push({ callback, delay });
      return timers.length;
    },
    clearTimer: () => {},
    log: { warn() {} },
  });
  const runTimer = () => timers.shift().callback();
  return { connection, ports, timers, events, runTimer };
}

test("messages are held back until the tray program says ready", () => {
  const { connection, ports, events } = setup();
  connection.start();
  assert.equal(connection.send({ type: "state" }), false);
  ports[0].onMessage.fire({ type: "command", command: "hide" });
  assert.deepEqual(events, []);

  ports[0].onMessage.fire({ type: "ready", version: "0.1.0" });
  assert.equal(connection.ready, true);
  assert.equal(connection.send({ type: "state" }), true);
  assert.deepEqual(ports[0].sent, [{ type: "state" }]);

  ports[0].onMessage.fire({ type: "command", command: "hide" });
  assert.deepEqual(events, [
    ["ready", { type: "ready", version: "0.1.0" }],
    ["message", { type: "command", command: "hide" }],
  ]);
});

test("a missing tray program is retried with a growing delay", () => {
  const { connection, ports, timers, events, runTimer } = setup();
  connection.start();
  ports[0].error = { message: "No such native application" };
  ports[0].onDisconnect.fire(ports[0]);
  // Never connected, so nothing was lost.
  assert.deepEqual(events, []);
  assert.equal(timers[0].delay, 2000);

  runTimer();
  ports[1].onDisconnect.fire(ports[1]);
  assert.equal(timers[0].delay, 4000);

  runTimer();
  ports[2].onMessage.fire({ type: "ready" });
  ports[2].onDisconnect.fire(ports[2]);
  assert.deepEqual(events.at(-1), ["lost"]);
  // A successful connection resets the delay.
  assert.equal(timers[0].delay, 2000);
});

test("the delay stops growing at one minute", () => {
  const { connection, ports, timers, runTimer } = setup();
  connection.start();
  for (let attempt = 0; attempt < 10; attempt++) {
    ports.at(-1).onDisconnect.fire();
    runTimer();
  }
  ports.at(-1).onDisconnect.fire();
  assert.equal(timers[0].delay, 60000);
});

test("stop disconnects and does not retry", () => {
  const { connection, ports, timers, events } = setup();
  connection.start();
  ports[0].onMessage.fire({ type: "ready" });
  connection.stop();
  assert.equal(ports[0].disconnected, true);
  assert.deepEqual(events.at(-1), ["lost"]);
  assert.equal(timers.length, 0);
});

test("events from a replaced port are ignored", () => {
  const { connection, ports, events, runTimer } = setup();
  connection.start();
  const first = ports[0];
  first.onDisconnect.fire();
  runTimer();
  first.onMessage.fire({ type: "ready" });
  first.onDisconnect.fire();
  assert.equal(connection.ready, false);
  assert.deepEqual(events, []);
});

test("a connect that throws is retried", () => {
  const timers = [];
  const connection = new HostConnection({
    connect: () => {
      throw new Error("blocked");
    },
    onReady() {},
    onMessage() {},
    onLost() {},
    setTimer: (callback, delay) => timers.push(delay),
    clearTimer() {},
    log: { warn() {} },
  });
  connection.start();
  assert.deepEqual(timers, [2000]);
});
