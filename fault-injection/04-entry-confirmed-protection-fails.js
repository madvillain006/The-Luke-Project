// Scenario 04: simulate entry-confirmed → protection fails → retry → emergencyFlatten.
// Requires NODE_ENV != "production" (test hook in router.js).
const { api, pass, fail, info, sleep, readSnapshot, assertRunning } = require("./_lib");

async function runPath(flattenSucceeds) {
  info("--- Testing flatten_succeeds=" + flattenSucceeds + " ---");

  // Reset state first
  await api("POST", "/agent/autonomous/clear-critical", { acknowledged: true, reason: "fault-injection test reset" }).catch(() => {});
  await api("POST", "/agent/autonomous/_test/inject-state", {
    execution_blocked: false, critical_mismatch: false, running: false,
    open_position: null, execution: null
  });

  const r = await api("POST", "/agent/autonomous/_test/simulate-protection-failure", { flatten_succeeds: flattenSucceeds });
  if (r.status === 404) {
    fail("Test hook not available — is NODE_ENV set to 'production'? Start Jarvis without NODE_ENV=production");
    return false;
  }
  if (!r.body || !r.body.ok) {
    fail("simulate-protection-failure hook returned error: " + JSON.stringify(r.body));
    return false;
  }

  info("Hook response: phase=" + r.body.phase + " critical_mismatch=" + r.body.critical_mismatch + " execution_blocked=" + r.body.execution_blocked);

  // Verify retry events were logged
  const { lastLogs } = require("./_lib");
  const logs = lastLogs(30);
  const retryLogs = logs.filter(l => l.type === "execution-protection-retry");
  const allFailedLogs = logs.filter(l => l.type === "execution-protection-all-retries-failed");
  const flattenLog = logs.find(l => l.type === "emergency_flatten_confirmed" || l.type === "execution-emergency-flatten-success" || l.type === "execution-critical-mismatch");

  if (retryLogs.length < 2) {
    fail("Expected 2 protection-retry log entries, got " + retryLogs.length);
    return false;
  }
  if (!allFailedLogs.length) {
    fail("No execution-protection-all-retries-failed log entry found");
    return false;
  }

  if (flattenSucceeds) {
    if (r.body.phase !== "emergency_flatten_confirmed") {
      fail("Expected phase=emergency_flatten_confirmed, got " + r.body.phase);
      return false;
    }
    if (!r.body.execution_blocked) {
      fail("Expected execution_blocked=true after successful flatten");
      return false;
    }
    if (r.body.critical_mismatch) {
      fail("Expected critical_mismatch=false after successful flatten");
      return false;
    }
    // Verify new executions are blocked
    const startR = await api("POST", "/agent/autonomous/start", {});
    if (startR.body && startR.body.started !== false) {
      fail("Expected start to be blocked after execution_blocked, but got: " + JSON.stringify(startR.body));
      return false;
    }
    info("Start correctly blocked: " + (startR.body && startR.body.reason));
  } else {
    if (r.body.phase !== "emergency_flatten_failed") {
      fail("Expected phase=emergency_flatten_failed, got " + r.body.phase);
      return false;
    }
    if (!r.body.critical_mismatch) {
      fail("Expected critical_mismatch=true after flatten failure");
      return false;
    }
    if (!r.body.execution_blocked) {
      fail("Expected execution_blocked=true after flatten failure");
      return false;
    }
  }

  return true;
}

(async () => {
  await assertRunning();
  info("Expected: retry events logged, emergencyFlatten attempted, state reflects outcome");

  const pathA = await runPath(false);
  if (!pathA) return;
  info("Path A (flatten fails): critical_mismatch=true, execution_blocked=true ✓");

  // Clear critical before second path
  await api("POST", "/agent/autonomous/clear-critical", { acknowledged: true, reason: "fault-injection between paths" });

  const pathB = await runPath(true);
  if (!pathB) return;
  info("Path B (flatten succeeds): emergency_flatten_confirmed, execution_blocked=true, no critical_mismatch ✓");

  // Cleanup
  await api("POST", "/agent/autonomous/clear-critical", { acknowledged: true, reason: "fault-injection cleanup" });
  await api("POST", "/agent/autonomous/_test/inject-state", { execution_blocked: false, critical_mismatch: false, execution: null });

  pass("Both paths: retry x2 → flatten → correct state (fail=critical_mismatch, success=blocked-until-ack)");
})();
