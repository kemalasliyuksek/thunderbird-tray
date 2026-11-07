import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MAX_TEXT_LENGTH,
  clip,
  displayName,
  isCountedFolder,
  quotaPercent,
  selectRecent,
  summarize,
} from "../../extension/modules/summary.js";

const inbox = { accountId: "a1", specialUse: ["inbox"] };

test("inbox mode counts only real inboxes", () => {
  assert.equal(isCountedFolder(inbox, "inbox"), true);
  assert.equal(isCountedFolder({ specialUse: [] }, "inbox"), false);
  assert.equal(isCountedFolder({ ...inbox, isUnified: true }, "inbox"), false);
  assert.equal(isCountedFolder({ ...inbox, isVirtual: true }, "inbox"), false);
  assert.equal(isCountedFolder({ ...inbox, isTag: true }, "inbox"), false);
});

test("all-folders mode skips junk, trash, sent and the like", () => {
  assert.equal(isCountedFolder({ specialUse: [] }, "all"), true);
  assert.equal(isCountedFolder({}, "all"), true);
  assert.equal(isCountedFolder(inbox, "all"), true);
  for (const use of ["junk", "trash", "sent", "drafts", "templates", "archives", "outbox"]) {
    assert.equal(isCountedFolder({ specialUse: [use] }, "all"), false, use);
  }
});

test("quota is the fullest storage quota in percent", () => {
  assert.equal(quotaPercent(undefined), null);
  assert.equal(quotaPercent([]), null);
  assert.equal(quotaPercent([{ type: "MESSAGE", limit: 10, used: 9 }]), null);
  assert.equal(quotaPercent([{ type: "STORAGE", limit: 0, used: 5 }]), null);
  assert.equal(
    quotaPercent([
      { type: "STORAGE", limit: 200, used: 50 },
      { type: "STORAGE", limit: 100, used: 85 },
    ]),
    85
  );
});

test("summarize totals unread and new mail per account", () => {
  const accounts = [
    { id: "a1", name: "Personal" },
    { id: "a2", name: "Work" },
  ];
  const counted = [
    { folder: { accountId: "a1" }, info: { unreadMessageCount: 3, newMessageCount: 1 } },
    { folder: { accountId: "a1" }, info: { unreadMessageCount: 2, newMessageCount: 0 } },
    { folder: { accountId: "a2" }, info: { unreadMessageCount: 4 } },
    // A folder of an account that was just removed still counts in the total.
    { folder: { accountId: "gone" }, info: { unreadMessageCount: 1 } },
  ];
  const inboxes = [
    { folder: { accountId: "a2" }, info: { quota: [{ type: "STORAGE", limit: 10, used: 9 }] } },
  ];
  assert.deepEqual(summarize({ accounts, counted, inboxes }), {
    unread: 10,
    newMessages: 1,
    accounts: [
      { id: "a1", name: "Personal", unread: 5, newMessages: 1, quotaPercent: null },
      { id: "a2", name: "Work", unread: 4, newMessages: 0, quotaPercent: 90 },
    ],
  });
});

test("display names come from the address header", () => {
  assert.equal(displayName("Ada Lovelace <ada@example.com>"), "Ada Lovelace");
  assert.equal(displayName('"Doe, John" <john@example.com>'), "Doe, John");
  assert.equal(displayName("<only@example.com>"), "only@example.com");
  assert.equal(displayName("plain@example.com"), "plain@example.com");
  assert.equal(displayName(undefined), "");
});

test("clip flattens whitespace and bounds the length", () => {
  assert.equal(clip("  a\n\tb  "), "a b");
  const long = clip("x".repeat(MAX_TEXT_LENGTH + 50));
  assert.equal(long.length, MAX_TEXT_LENGTH);
  assert.ok(long.endsWith("…"));
});

test("recent messages are the newest unread ones", () => {
  const names = new Map([["a1", "Personal"]]);
  const message = (id, date, extra = {}) => ({
    id,
    date,
    author: `Sender ${id} <s${id}@example.com>`,
    subject: `Subject ${id}`,
    read: false,
    junk: false,
    folder: { accountId: "a1" },
    ...extra,
  });
  const recent = selectRecent(
    [
      message(1, "2026-11-01T10:00:00Z"),
      message(2, "2026-11-03T10:00:00Z"),
      message(3, "2026-11-04T10:00:00Z", { read: true }),
      message(4, "2026-11-05T10:00:00Z", { junk: true }),
      message(5, "2026-11-02T10:00:00Z", { folder: { accountId: "unknown" } }),
    ],
    3,
    names
  );
  assert.deepEqual(
    recent.map(item => item.id),
    [2, 5, 1]
  );
  assert.deepEqual(recent[0], {
    id: 2,
    author: "Sender 2",
    subject: "Subject 2",
    date: "2026-11-03T10:00:00.000Z",
    account: "Personal",
  });
  assert.equal(recent[1].account, "");
});
