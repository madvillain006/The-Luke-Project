// Scenario 05: inject a failing scheduler job 3x, expect stale/failed state in /scheduler/status.
const fs = require("fs");
const { api, pass, fail, info, sleep, SCHED_JOBS_FILE, assertRunning } = require("./_lib");

(async () => {
  await assertRunning();

  info("Expected: injected job shows state=failed and stale=true in /scheduler/status");

  const jobName = "fault-injection-test-job";
  const longAgo = new Date(Date.now() - 48 * 3600000).toISOString(); // 48h ago

  // Read original jobs file
  let original = null;
  try { original = fs.readFileSync(SCHED_JOBS_FILE, "utf8"); } catch {}

  try {
    // Inject a job that has failed 3 times and hasn't succeeded in 48h
    const jobs = original ? JSON.parse(original) : {};
    jobs[jobName] = {
      state: "failed",
      last_started: longAgo,
      last_failed:  longAgo,
      last_succeeded: null,
      error: "simulated fault injection failure (run 3)",
      duration_ms: 1200
    };
    fs.writeFileSync(SCHED_JOBS_FILE, JSON.stringify(jobs, null, 2));
    info("Injected failing job: " + jobName);

    const r = await api("GET", "/scheduler/status");
    if (r.status !== 200 || !r.body || !r.body.jobs) {
      fail("scheduler/status returned unexpected response: " + r.status);
      return;
    }

    const injected = r.body.jobs[jobName];
    if (!injected) {
      fail("Injected job not found in /scheduler/status response");
      return;
    }
    info("Job in response: state=" + injected.state + " stale=" + injected.stale);

    if (injected.state !== "failed") {
      fail("Expected state=failed, got: " + injected.state);
      return;
    }
    if (!injected.stale) {
      fail("Expected stale=true (48h since last run), got stale=" + injected.stale);
      return;
    }

    pass("Failing scheduler job detected: state=failed, stale=true");
  } finally {
    // Restore original jobs file
    try {
      if (original) {
        const jobs = JSON.parse(original);
        delete jobs[jobName];
        fs.writeFileSync(SCHED_JOBS_FILE, JSON.stringify(jobs, null, 2));
      } else {
        const current = JSON.parse(fs.readFileSync(SCHED_JOBS_FILE, "utf8"));
        delete current[jobName];
        fs.writeFileSync(SCHED_JOBS_FILE, JSON.stringify(current, null, 2));
      }
    } catch {}
  }
})();
