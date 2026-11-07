// SPDX-License-Identifier: MIT

import { DEFAULT_SETTINGS, normalizeSettings } from "../modules/settings.js";

const form = document.body;

for (const element of document.querySelectorAll("[data-i18n]")) {
  element.textContent = browser.i18n.getMessage(element.dataset.i18n);
}

function readForm() {
  const raw = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const input = form.querySelector(`[name="${key}"]`);
    if (input.type == "checkbox") {
      raw[key] = input.checked;
    } else if (input.type == "number") {
      raw[key] = Number.parseInt(input.value, 10);
    } else {
      raw[key] = input.value;
    }
  }
  return normalizeSettings(raw);
}

function fillForm(settings) {
  for (const [key, value] of Object.entries(settings)) {
    const input = form.querySelector(`[name="${key}"]`);
    if (input.type == "checkbox") {
      input.checked = value;
    } else {
      input.value = String(value);
    }
  }
}

async function showStatus() {
  const { connected } = await browser.runtime.sendMessage({ type: "getStatus" });
  const status = document.getElementById("status");
  status.textContent = browser.i18n.getMessage(
    connected ? "options_statusConnected" : "options_statusMissing"
  );
  status.classList.toggle("missing", !connected);
}

const stored = await browser.storage.local.get("settings");
fillForm(normalizeSettings(stored.settings));
form.addEventListener("change", async () => {
  const settings = readForm();
  fillForm(settings);
  await browser.storage.local.set({ settings });
});
await showStatus();
