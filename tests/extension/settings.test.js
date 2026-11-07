import assert from "node:assert/strict";
import { test } from "node:test";

import { DEFAULT_SETTINGS, MAX_RECENT, normalizeSettings } from "../../extension/modules/settings.js";

test("missing settings fall back to the defaults", () => {
  assert.deepEqual(normalizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(normalizeSettings("nonsense"), DEFAULT_SETTINGS);
});

test("valid values are kept", () => {
  const settings = normalizeSettings({
    closeToTray: false,
    minimizeToTray: true,
    startHidden: true,
    countMode: "all",
    showBadge: false,
    recentCount: 0,
    middleClick: "none",
  });
  assert.deepEqual(settings, {
    closeToTray: false,
    minimizeToTray: true,
    startHidden: true,
    countMode: "all",
    showBadge: false,
    recentCount: 0,
    middleClick: "none",
  });
});

test("invalid values are replaced one by one", () => {
  const settings = normalizeSettings({
    closeToTray: "yes",
    countMode: "everything",
    middleClick: 3,
    recentCount: 2.5,
    startHidden: true,
  });
  assert.equal(settings.closeToTray, DEFAULT_SETTINGS.closeToTray);
  assert.equal(settings.countMode, DEFAULT_SETTINGS.countMode);
  assert.equal(settings.middleClick, DEFAULT_SETTINGS.middleClick);
  assert.equal(settings.recentCount, DEFAULT_SETTINGS.recentCount);
  assert.equal(settings.startHidden, true);
});

test("the recent message count is clamped", () => {
  assert.equal(normalizeSettings({ recentCount: 99 }).recentCount, MAX_RECENT);
  assert.equal(normalizeSettings({ recentCount: -4 }).recentCount, 0);
});

test("unknown keys from older versions are dropped", () => {
  assert.equal("legacy" in normalizeSettings({ legacy: true }), false);
});
