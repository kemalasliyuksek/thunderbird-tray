// SPDX-License-Identifier: MIT

/** Folders whose unread messages are not worth a badge in "all folders" mode. */
export const EXCLUDED_SPECIAL_USES = Object.freeze([
  "archives",
  "drafts",
  "junk",
  "outbox",
  "sent",
  "templates",
  "trash",
]);

/** How far back the "recent unread" list looks. */
export const RECENT_DAYS = 14;

/** Upper bound for text sent to the tray, so one odd message cannot bloat it. */
export const MAX_TEXT_LENGTH = 200;

export function isCountedFolder(folder, mode) {
  if (folder.isVirtual || folder.isUnified || folder.isTag) {
    return false;
  }
  const uses = folder.specialUse ?? [];
  if (mode == "inbox") {
    return uses.includes("inbox");
  }
  return !uses.some(use => EXCLUDED_SPECIAL_USES.includes(use));
}

/** The fullest storage quota in percent, or null when the server reports none. */
export function quotaPercent(quotas) {
  let best = null;
  for (const quota of quotas ?? []) {
    if (quota.type != "STORAGE" || !(quota.limit > 0)) {
      continue;
    }
    const percent = Math.round((quota.used / quota.limit) * 100);
    best = best == null ? percent : Math.max(best, percent);
  }
  return best;
}

/**
 * Totals unread and new messages per account.
 *
 * @param {object} input
 * @param {Array<{id: string, name: string}>} input.accounts - In Thunderbird's order.
 * @param {Array<{folder: object, info: object}>} input.counted - Folders that count.
 * @param {Array<{folder: object, info: object}>} input.inboxes - For quota only.
 */
export function summarize({ accounts, counted, inboxes }) {
  const perAccount = new Map(
    accounts.map(account => [
      account.id,
      { id: account.id, name: account.name, unread: 0, newMessages: 0, quotaPercent: null },
    ])
  );
  let unread = 0;
  let newMessages = 0;
  for (const { folder, info } of counted) {
    const account = perAccount.get(folder.accountId);
    const folderUnread = info.unreadMessageCount ?? 0;
    const folderNew = info.newMessageCount ?? 0;
    unread += folderUnread;
    newMessages += folderNew;
    if (account) {
      account.unread += folderUnread;
      account.newMessages += folderNew;
    }
  }
  for (const { folder, info } of inboxes) {
    const account = perAccount.get(folder.accountId);
    const percent = quotaPercent(info.quota);
    if (account && percent != null) {
      account.quotaPercent = Math.max(account.quotaPercent ?? 0, percent);
    }
  }
  return { unread, newMessages, accounts: [...perAccount.values()] };
}

export function clip(text) {
  const flat = String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > MAX_TEXT_LENGTH ? `${flat.slice(0, MAX_TEXT_LENGTH - 1)}…` : flat;
}

/** "Ada Lovelace <ada@example.com>" → "Ada Lovelace"; a bare address stays an address. */
export function displayName(author) {
  const text = String(author ?? "").trim();
  const match = text.match(/^(.*?)\s*<([^>]*)>$/);
  if (!match) {
    return clip(text);
  }
  const name = match[1].replace(/^"(.*)"$/, "$1").trim();
  return clip(name || match[2]);
}

/**
 * The newest unread messages, newest first.
 *
 * @param {object[]} messages - MessageHeader objects.
 * @param {number} limit
 * @param {Map<string, string>} accountNames - Account id to name.
 */
export function selectRecent(messages, limit, accountNames) {
  return messages
    .filter(message => !message.read && !message.junk)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit)
    .map(message => ({
      id: message.id,
      author: displayName(message.author),
      subject: clip(message.subject),
      date: new Date(message.date).toISOString(),
      account: accountNames.get(message.folder?.accountId) ?? "",
    }));
}
