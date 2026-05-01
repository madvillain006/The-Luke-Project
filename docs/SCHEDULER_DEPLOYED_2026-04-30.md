# luke-scheduler PM2 Deploy — 2026-04-30

## ecosystem.config.js

No modification needed. luke-scheduler entry was already present with correct config:
- script: scheduler.js
- autorestart: true
- env: ANTHROPIC_API_KEY and MASSIVE_API_KEY both read from process.env (not hardcoded)
- restart_delay: 3000, max_restarts: 5, min_uptime: 60s

## pm2 status (post-start)

```
┌────┬───────────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id │ name              │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├────┼───────────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 1  │ luke-scheduler    │ default     │ 1.0.0   │ fork    │ 13032    │ 10s    │ 0    │ online    │ 0%       │ 43.9mb   │ conor    │ disabled │
│ 0  │ luke-server       │ default     │ 1.0.0   │ fork    │ 24284    │ 2h     │ 0    │ online    │ 0%       │ 7.5mb    │ conor    │ disabled │
└────┴───────────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

Both processes: online, 0 restarts.

## Scheduler log (last 20 lines)

```
[TAILING] Tailing last 20 lines for [luke-scheduler] process
C:\Users\conor\.pm2\logs\luke-scheduler-out.log last 20 lines:
C:\Users\conor\.pm2\logs\luke-scheduler-error.log last 20 lines:
```

Log files exist but are empty — expected. The saty-auto-pull job fires on a scheduled
interval (Friday 8:25–8:35 ET), not immediately on startup. No errors, no crash-loop.

## pm2 save

```
[PM2] Saving current process list...
[PM2] Successfully saved in C:\Users\conor\.pm2\dump.pm2
```

Both processes persisted. Will survive reboot.

## Commit

No commit made. ecosystem.config.js was not modified this session — it was already correct.

## Status

CLEAN. Scheduler is live and supervised. Friday morning saty-auto-pull will fire.
