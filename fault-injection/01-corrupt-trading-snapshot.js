// Scenario 01: corrupt the trading snapshot, expect logged recovery — not silent default.
const fs = require("fs");
const { api, pass, fail, info, sleep, SNAPSHOT_FILE, lastEvents, assertRunning } = require("./_lib");

(async () => {
  await assertRunning();

  // Backup original snapshot
  let original = null;
  try { original = fs.readFileSync(SNAPSHOT_FILE, "utf8"); } catch {}

  const eventsBefore = lastEvents(50).length;
  info("Expected: /agent/autonomous/status returns valid JSON after corrupt snapshot");
  info("Expected: trading-events.jsonl gains TRADING_STATE_INITIALIZED or RECOVERED_FROM_LEGACY event");

  try {
    // Corrupt the snapshot
    fs.mkdirSync(require("path").dirname(SNAPSHOT_FILE), { recursive: true });
    fs.writeFileSync(SNAPSHOT_FILE, "NOT_VALID_JSON{{{{{{{{", "utf8");
    info("Wrote corrupt JSON to snapshot file");

    // Trigger a state read
    const r = await api("GET", "/agent/autonomous/status");
    if (r.status !== 200 || typeof r.body !== "object") {
      fail("status endpoint returned non-200 or non-JSON after corrupt snapshot");
      return;
    }
    info("status endpoint returned valid JSON: " + JSON.stringify(r.body).slice(0, 80));

    await sleep(200);
    const eventsAfter = lastEvents(50);
    const recoveryEvent = eventsAfter.find(e =>
      e.type === "TRADING_STATE_INITIALIZED" ||
      e.type === "TRADING_STATE_RECOVERED_FROM_LEGACY"
    );
    if (!recoveryEvent) {
      fail("No recovery event in trading-events.jsonl — corrupt snapshot failed silently without logging");
      return;
    }
    info("Recovery event found: " + recoveryEvent.type);
    pass("Corrupt snapshot logged recovery event '" + recoveryEvent.type + "', status endpoint still healthy");
  } finally {
    // Restore
    if (original) fs.writeFileSync(SNAPSHOT_FILE, original, "utf8");
    else try { fs.unlinkSync(SNAPSHOT_FILE); } catch {}
  }
})();
