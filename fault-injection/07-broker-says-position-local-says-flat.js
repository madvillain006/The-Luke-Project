// Scenario 07: broker reports phantom open position, local state says flat — expect critical mismatch.
// Uses the /_test/reconcile-phantom hook (no real Tradovate call).
const { api, pass, fail, info, readSnapshot, assertRunning } = require("./_lib");

(async () => {
  await assertRunning();

  info("Expected: phantom broker position detected as critical mismatch");
  info("Expected: mismatches includes 'Broker shows open position but local state is flat'");

  // Ensure local state is flat
  const before = readSnapshot();
  if (before && before.open_position) {
    await api("POST", "/agent/autonomous/_test/inject-state", { open_position: null });
  }

  const r = await api("POST", "/agent/autonomous/_test/reconcile-phantom", {});
  if (r.status === 404) {
    fail("Test hook not available — is NODE_ENV set to 'production'?");
    return;
  }
  if (r.status !== 200 || !r.body) {
    fail("reconcile-phantom returned unexpected: " + r.status + " " + JSON.stringify(r.body));
    return;
  }

  info("Reconcile result: ok=" + r.body.ok + " critical=" + r.body.critical);
  info("Mismatches: " + JSON.stringify(r.body.mismatches));

  if (r.body.ok) {
    fail("Reconcile returned ok:true despite phantom position — mismatch not detected");
    return;
  }
  if (!r.body.critical) {
    fail("critical flag not set despite detected mismatch");
    return;
  }
  const hasPhantomMsg = (r.body.mismatches || []).some(m =>
    m.toLowerCase().includes("broker shows open position") || m.toLowerCase().includes("phantom")
  );
  if (!hasPhantomMsg) {
    fail("Expected mismatch message about broker position, got: " + JSON.stringify(r.body.mismatches));
    return;
  }

  // Verify that start is blocked when reconcile shows critical
  // (The /start route blocks when reconciliation fails in live mode)
  info("Phantom position mismatch correctly detected in reconcile layer");
  pass("Broker phantom position → ok:false, critical:true, mismatch message present");
})();
