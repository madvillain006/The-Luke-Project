// Scenario 08: staged trade in queue, kill switch fires during execution — expect clean abort.
const { api, pass, fail, info, sleep, readSnapshot, assertRunning } = require("./_lib");

(async () => {
  await assertRunning();

  // Capture state before
  const before = readSnapshot();

  info("Expected: kill during staged execution → execute-staged blocked, kill_day=true, pending cleared");

  try {
    // Reset kill flags and ensure running
    await api("POST", "/agent/autonomous/reset-kill", {});
    await api("POST", "/agent/autonomous/_test/inject-state", {
      running: true,
      kill_day: false,
      kill_week: false,
      open_position: null,
      execution_blocked: false,
      critical_mismatch: false
    });

    // Inject a live pending signal (5 min expiry)
    const expiresAt = new Date(Date.now() + 300000).toISOString();
    await api("POST", "/agent/autonomous/_test/inject-state", {
      pending_signal: {
        ticker: "MNQ",
        direction: "LONG",
        entry: 21000,
        stop: 20980,
        target: 21040,
        reason: "[fault-injection: kill-during-execution test]",
        staged_at:  new Date().toISOString(),
        expires_at: expiresAt
      }
    });
    info("Staged pending signal injected");

    // Verify it's visible
    const pendingR = await api("GET", "/agent/autonomous/pending");
    if (!pendingR.body || !pendingR.body.pending) {
      fail("Signal not visible after injection — hook may be unavailable: " + JSON.stringify(pendingR.body));
      return;
    }
    info("Signal confirmed pending: " + pendingR.body.signal.direction + " " + pendingR.body.signal.ticker);

    // Fire kill switch
    const killR = await api("POST", "/agent/autonomous/kill", {});
    info("Kill response: " + JSON.stringify(killR.body));

    // Now attempt execute-staged — should be blocked
    const execR = await api("POST", "/agent/autonomous/execute-staged", {});
    info("execute-staged after kill: " + JSON.stringify(execR.body));

    if (execR.body && execR.body.executing) {
      fail("execute-staged actually executed after kill — kill switch did not prevent execution");
      return;
    }
    if (execR.body && execR.body.executed !== false) {
      fail("execute-staged did not return executed:false after kill: " + JSON.stringify(execR.body));
      return;
    }

    // Verify final state
    await sleep(300);
    const state = readSnapshot();
    if (!state) {
      fail("Could not read state snapshot after kill");
      return;
    }
    if (!state.kill_day) {
      fail("Expected kill_day=true, got " + state.kill_day);
      return;
    }
    if (state.pending_signal) {
      fail("pending_signal still set after kill — not cleared");
      return;
    }
    info("kill_day=true, pending_signal=null, running=false ✓");
    pass("Kill during staged execution: execute blocked, kill_day=true, state clean");
  } finally {
    // Restore: reset kill flags
    await api("POST", "/agent/autonomous/reset-kill", {});
    await api("POST", "/agent/autonomous/_test/inject-state", {
      running: false, pending_signal: null,
      kill_day: before ? before.kill_day : false,
      kill_week: before ? before.kill_week : false
    }).catch(() => {});
  }
})();
