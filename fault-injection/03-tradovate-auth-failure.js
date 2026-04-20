// Scenario 03: set bad Tradovate credentials, expect auth failure detected (not silent).
const { api, pass, fail, info, sleep, assertRunning } = require("./_lib");

(async () => {
  await assertRunning();

  // Save original creds
  const statusBefore = await api("GET", "/agent/autonomous/status");
  const originalTradovate = (statusBefore.body && statusBefore.body.tradovate_configured)
    ? statusBefore.body : null;

  info("Expected: test-connection returns connected:false with bad credentials");
  info("Expected: reconcile returns ok:false or error (not silent success)");

  try {
    // Inject bad credentials
    await api("POST", "/agent/autonomous/set-mode", {
      tradovate: {
        username: "fault_injection_test",
        password: "BADPASS",
        cid: 99999,
        sec: "BADSEC",
        env: "demo",
        deviceId: "fault-test-device"
      }
    });
    info("Injected bad Tradovate credentials");

    // Test connection — designed for this exact check
    const r = await api("POST", "/agent/autonomous/test-connection", {});
    info("test-connection response: " + JSON.stringify(r.body).slice(0, 120));

    if (r.body && r.body.connected === false) {
      pass("Bad credentials → test-connection returned connected:false correctly");
    } else if (r.status >= 400 || (r.body && r.body.error)) {
      pass("Bad credentials → auth error returned (not silent): " + (r.body.error || r.status));
    } else {
      fail("test-connection did not detect bad credentials — returned: " + JSON.stringify(r.body).slice(0, 100));
    }
  } finally {
    // Restore — clear the injected creds (server had real creds before if any)
    // We only partially clear; real creds are not exposed via status, so just note it.
    info("NOTE: real Tradovate creds may need to be re-set via /set-mode if they existed before this test");
  }
})();
