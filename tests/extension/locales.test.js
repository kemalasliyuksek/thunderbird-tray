import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";

import { LABEL_KEYS } from "../../extension/modules/labels.js";

const root = new URL("../../extension/", import.meta.url);
const locales = readdirSync(new URL("_locales/", root));
const read = locale =>
  JSON.parse(readFileSync(new URL(`_locales/${locale}/messages.json`, root), "utf8"));

const english = read("en");

test("every label the tray program needs has an English message", () => {
  for (const key of LABEL_KEYS) {
    assert.ok(english[`label_${key}`]?.message, key);
  }
});

test("every string used in the options page exists", () => {
  const html = readFileSync(new URL("options/options.html", root), "utf8");
  for (const [, key] of html.matchAll(/data-i18n="([^"]+)"/g)) {
    assert.ok(english[key]?.message, key);
  }
});

for (const locale of locales) {
  test(`${locale} has the same keys and placeholders as English`, () => {
    const messages = read(locale);
    assert.deepEqual(Object.keys(messages).sort(), Object.keys(english).sort());
    for (const [key, { message }] of Object.entries(english)) {
      const placeholders = text => [...text.matchAll(/\{\w+\}/g)].map(m => m[0]).sort();
      assert.deepEqual(placeholders(messages[key].message), placeholders(message), key);
    }
  });
}

test("the manifest and options page only use messages that exist", () => {
  const manifest = readFileSync(new URL("manifest.json", root), "utf8");
  for (const [, key] of manifest.matchAll(/__MSG_(\w+)__/g)) {
    assert.ok(english[key]?.message, key);
  }
});
