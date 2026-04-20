// Scenario 09: log Mirtazapine+Prednisone before Omeprazole same day — expect protocol-violation flag.
// KNOWN BUG: persistLukeEntry only checks meds.includes("combined"), not day-level ordering.
// This test will FAIL, pinpointing the missing ordering check.
const { api, pass, fail, info, assertRunning } = require("./_lib");

(async () => {
  await assertRunning();

  info("Expected: submitting Mirtazapine+Prednisone WITHOUT prior Omeprazole → MED PROTOCOL VIOLATION flag");
  info("Known current behavior: only meds.includes('combined') triggers the flag");

  // Scenario A: what the code actually checks (combined string)
  const rA = await api("POST", "/agent/health/log-luke", {
    meds: "mirtazapine+prednisone combined with omeprazole",
    notes: "fault-injection test A — combined string present"
  });
  info("Test A (combined string present): reply=" + JSON.stringify(rA.body && rA.body.reply));
  const flaggedA = rA.body && rA.body.reply && rA.body.reply.includes("MED PROTOCOL VIOLATION");
  info("  MED PROTOCOL VIOLATION flag present: " + flaggedA);

  // Scenario B: the real out-of-order case (no "combined" keyword — actual protocol violation)
  const rB = await api("POST", "/agent/health/log-luke", {
    meds: "mirtazapine+prednisone",
    notes: "fault-injection test B — given BEFORE omeprazole this morning"
  });
  info("Test B (out-of-order, no combined string): reply=" + JSON.stringify(rB.body && rB.body.reply));
  const flaggedB = rB.body && rB.body.reply && rB.body.reply.includes("MED PROTOCOL VIOLATION");
  info("  MED PROTOCOL VIOLATION flag present: " + flaggedB);

  if (flaggedB) {
    pass("Protocol violation detected for out-of-order meds — ordering check is implemented");
  } else {
    fail(
      "Out-of-order meds NOT flagged as protocol violation.\n" +
      "  Bug: persistLukeEntry only checks meds.includes('combined'), has no same-day ordering check.\n" +
      "  Fix needed: track today's meds in sequence and reject Mirtazapine+Prednisone if Omeprazole not logged first today."
    );
  }
})();
