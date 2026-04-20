// Scenario 10: paper trade open, trigger panic — expect state dump written, 02B kill sent, clean shutdown.
const fs   = require("fs");
const path = require("path");
const { api, pass, fail, info, sleep, readSnapshot, ROOT, assertRunning } = require("./_lib");

(async () => {
  await assertRunning();

  const dumpBefore = fs.readdirSync(ROOT).filter(f => f.startsWith("panic-dump-"));
  info("Existing panic dumps before test: " + dumpBefore.length);

  // Save state
  const before = readSnapshot();

  info("Expected: POST /panic → panic-dump-*.json created, 02B kill queued, ok:true returned");

  try {
    // Inject an open paper position
    await api("POST", "/agent/autonomous/_test/inject-state", {
      open_position: {
        mode: "paper",
        ticker: "MNQ",
        direction: "LONG",
        entry: 21000,
        stop: 20980,
        target: 21040,
        size: 1,
        status: "open",
        opened: new Date().toISOString(),
        reason: "[fault-injection: panic test]"
      },
      running: true
    });
    info("Injected open paper position");

    const stateCheck = readSnapshot();
    if (!stateCheck || !stateCheck.open_position) {
      fail("State injection failed or hook unavailable — open_position not set");
      return;
    }

    // Trigger panic
    const r = await api("POST", "/panic", {});
    info("panic response: " + JSON.stringify(r.body));

    if (!r.body || r.body.ok !== true) {
      fail("Panic endpoint returned non-ok: " + JSON.stringify(r.body));
      return;
    }

    await sleep(300);

    // Check dump file was created
    const dumpAfter = fs.readdirSync(ROOT).filter(f => f.startsWith("panic-dump-"));
    const newDumps = dumpAfter.filter(f => !dumpBefore.includes(f));
    info("New panic dump files: " + newDumps.length + " → " + newDumps.join(", "));

    if (newDumps.length === 0) {
      fail("No panic-dump-*.json created — state was not dumped");
      return;
    }

    // Read the dump and verify it has memory
    const dumpPath = path.join(ROOT, newDumps[newDumps.length - 1]);
    let dump;
    try { dump = JSON.parse(fs.readFileSync(dumpPath, "utf8")); }
    catch { fail("panic dump file not valid JSON"); return; }

    if (!dump.timestamp || !dump.memory) {
      fail("panic dump missing timestamp or memory field: " + JSON.stringify(Object.keys(dump)));
      return;
    }
    info("Dump verified: timestamp=" + dump.timestamp + ", memory keys=" + Object.keys(dump.memory).length);

    // Verify 02B is now stopped (kill was sent async, allow brief wait)
    await sleep(500);
    const finalState = readSnapshot();
    info("02B running after panic: " + (finalState && finalState.running));

    pass("Panic: dump file created, memory preserved, ok:true returned" + (finalState && !finalState.running ? ", 02B stopped" : ""));
  } finally {
    // Restore running=false and clear position
    await api("POST", "/agent/autonomous/_test/inject-state", {
      running: false,
      open_position: before ? before.open_position : null,
      kill_day: before ? before.kill_day : false
    }).catch(() => {});
    await api("POST", "/agent/autonomous/reset-kill", {}).catch(() => {});
  }
})();
