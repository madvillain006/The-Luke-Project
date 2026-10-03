"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { borrowedBrowser } = require("../scripts/muggzone-observe");
test("observer release leaves the user-owned desktop context open", async () => {
  let closed = false;
  const context = { pages: () => ["manual-tab"], close: async () => { closed = true; } };
  const borrowed = borrowedBrowser(context);
  assert.deepEqual(borrowed.contexts()[0].pages(), ["manual-tab"]);
  await borrowed.close();
  assert.equal(closed, false);
});
test("desktop attachment rejects a missing context", () => {
  assert.throws(() => borrowedBrowser(null), /live browser context/);
  assert.throws(() => borrowedBrowser({}), /live browser context/);
});
