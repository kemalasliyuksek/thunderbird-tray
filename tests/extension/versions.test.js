import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("the add-on and the tray program carry the same version", () => {
  const manifest = JSON.parse(read("extension/manifest.json")).version;
  const packageJson = JSON.parse(read("package.json")).version;
  const pyproject = read("host/pyproject.toml").match(/^version = "([^"]+)"/m)[1];
  const python = read("host/src/thunderbird_tray/__init__.py").match(/__version__ = "([^"]+)"/)[1];
  assert.deepEqual([packageJson, pyproject, python], [manifest, manifest, manifest]);
});

test("both sides use the same add-on id and host name", () => {
  const manifest = JSON.parse(read("extension/manifest.json"));
  const python = read("host/src/thunderbird_tray/__init__.py");
  const hostModule = read("extension/modules/host.js");
  const id = manifest.browser_specific_settings.gecko.id;
  const hostName = hostModule.match(/HOST_NAME = "([^"]+)"/)[1];
  assert.ok(python.includes(`EXTENSION_ID = "${id}"`));
  assert.ok(python.includes(`HOST_NAME = "${hostName}"`));
});
