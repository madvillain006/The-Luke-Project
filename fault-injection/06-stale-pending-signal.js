// Scenario 06: inject an already-expired pending signal, expect expiry detected and cleared.
const { api, pass, fail, info, sleep, readSnapshot, assertRunning } = require("./_lib");

(async () => {
  await assertRunning();

  // Snapshot original state
  const before = readSnapshot();

  info("Expected: expired pending signal → /pending returns { pending:false, reason:'expired' }");
  info("Expected: state.pending_signal cleared after expiry check");

  try {
    // Inject a pending signal that expired 60 seconds ago
    const expiredAt = new Date(Date.now() - 60000).toISOString();
    const stagedAt  = new Date(Date.now() - 360000).toISOString();
    await api("POST", "/agent/autonomous/_test/inject-state", {
      pending_signal: {
        ticker: "MNQ",
        direction: "LONG",
        entry: 21000,
        stop: 20980,
        target: 21040,
        reason: "[fault-injection: stale signal test]",
        staged_at:  stagedAt,
        expires_at: expiredAt
      }
    });
    info("Injected expired pending signal (expired_at=" + expiredAt + ")");

    const r = await api("GET", "/agent/autonomous/pending");
    info("pending response: " + JSON.stringify(r.body));

    if (r.status !== 200) {
      fail("pending endpoint returned " + r.status);
      return;
    }
    if (r.body.pending !== false) {
      fail("Expected pending:false for expired signal, got pending:" + r.body.pending);
      return;
    }
    // Check signal was cleared
    await sleep(200);
    const after = readSnapshot();
    if (after && after.pending_signal) {
      fail("pending_signal still set in state after expiry check — not cleared");
      return;
    }
    info("pending_signal cleared from state ✓");
    pass("Expired pending signal: detected, pending:false returned, state cleared");
  } finally {
    // Restore pending_signal = null in case hook was not available
    await api("POST", "/agent/autonomous/_test/inject-state", { pending_signal: null }).catch(() => {});
    // If test hook unavailable, at least state is clean after the /pending call cleared it
  }
})();
