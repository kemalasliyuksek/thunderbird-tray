// SPDX-License-Identifier: MIT

/**
 * Strings the tray program shows, sent to it so that it follows Thunderbird's
 * language. Values may contain {placeholders} that the tray program fills in.
 */
export const LABEL_KEYS = Object.freeze([
  "trayTitle",
  "unreadSummary",
  "newSummary",
  "noUnread",
  "quotaWarning",
  "offlineNotice",
  "mutedNotice",
  "menuShow",
  "menuHide",
  "menuRecent",
  "noSubject",
  "menuCompose",
  "menuGetMail",
  "menuAddressBook",
  "menuCalendar",
  "menuTasks",
  "menuMuted",
  "menuOffline",
  "menuSettings",
  "menuQuit",
]);

export function collectLabels(getMessage) {
  return Object.fromEntries(LABEL_KEYS.map(key => [key, getMessage(`label_${key}`)]));
}
