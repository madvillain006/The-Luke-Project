// Scenario 02: delete trading snapshot, expect rebuild from legacy file and logged recovery.
const fs = require("fs");
const { api, pass, fail, info, sleep, SNAPSHOT_FILE, lastEvents, assertRunning } = require("./_lib");

(async () => {
  await assertRunning();

  let original = null;
  try { original = fs.readFileSync(SNAPSHOT_FILE, "utf8"); } catch {}

  info("Expected: snapshot deleted → server recovers from legacy file or defaults");
  info("Expected: TRADING_STATE_RECOVERED_FROM_LEGACY or TRADING_STATE_INITIALIZED logged");

  try {
    try { fs.unlinkSync(SNAPSHOT_FILE); } catch {}
    info("Deleted snapshot file");

    const r = await api("GET", "/agent/autonomous/status");
    if (r.status !== 200 || typeof r.body !== "object") {
      fail("status endpoint failed after snapshot deletion: " + r.status);
      return;
    }
    info("status returned valid JSON after deletion");

    await sleep(200);
    const events = lastEvents(50);
    const recoveryEvent = events.find(e =>
      e.type === "TRADING_STATE_INITIALIZED" ||
      e.type === "TRADING_STATE_RECOVERED_FROM_LEGACY"
    );
    if (!recoveryEvent) {
      fail("No recovery event found — snapshot deletion handled silently without logging");
      return;
    }
    info("Recovery event: " + recoveryEvent.type);
    pass("Deleted snapshot → recovery logged as '" + recoveryEvent.type + "', server healthy");
  } finally {
    // Server will have re-written snapshot during recovery; if original was better, restore it
    if (original) {
      try { fs.writeFileSync(SNAPSHOT_FILE, original, "utf8"); } catch {}
    }
  }
})();
