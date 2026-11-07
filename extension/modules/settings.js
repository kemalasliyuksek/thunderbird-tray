// SPDX-License-Identifier: MIT

export const MAX_RECENT = 15;

export const DEFAULT_SETTINGS = Object.freeze({
  closeToTray: true,
  minimizeToTray: false,
  startHidden: false,
  countMode: "inbox",
  showBadge: true,
  recentCount: 5,
  middleClick: "compose",
});

const CHOICES = Object.freeze({
  countMode: ["inbox", "all"],
  middleClick: ["compose", "getMail", "none"],
});

/**
 * Returns complete, valid settings from whatever was stored, which may be
 * missing, partial or written by an older version.
 */
export function normalizeSettings(raw) {
  const source = raw && typeof raw == "object" ? raw : {};
  const settings = { ...DEFAULT_SETTINGS };
  for (const [key, fallback] of Object.entries(DEFAULT_SETTINGS)) {
    const value = source[key];
    if (key in CHOICES) {
      settings[key] = CHOICES[key].includes(value) ? value : fallback;
    } else if (typeof fallback == "boolean") {
      settings[key] = typeof value == "boolean" ? value : fallback;
    } else if (typeof fallback == "number") {
      settings[key] = Number.isInteger(value) ? Math.min(Math.max(value, 0), MAX_RECENT) : fallback;
    }
  }
  return settings;
}
