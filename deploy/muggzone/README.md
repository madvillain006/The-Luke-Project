# MuggZone shadow observer: cloud desktop

This container runs a persistent Chromium desktop plus the narrow Node 24 observer. It
does not start Electron, the old screenshot/LLM scraper, a Discord bot, or a broker.
Discord sign-in is manual. The code reads only rendered UI for the configured channel.

## Build and provision

From the project root, build `docker build -f deploy/muggzone/Dockerfile -t muggzone-shadow:v1 .`.
Push to your chosen private registry before provisioning a fresh cloud instance. The
image has not been built or tested on a cloud pod by preparing these files.

Mount persistent storage at `/workspace`. Set `SSH_PUBLIC_KEY` to the public key used
by your SSH client. Optionally set `MUGGZONE_CHANNEL_URL` to the exact channel URL.
Expose only TCP port 22 through the cloud provider. Use Secure Cloud if using RunPod
for credentials. A CPU cloud desktop is enough for this observer; no GPU work occurs.
Do not reuse or stop a GPU pod occupied by a different workload.

After the cloud provider supplies an SSH host and mapped SSH port, run locally:

```sh
ssh -N -L 6080:127.0.0.1:6080 -p SSH_PORT trader@SSH_HOST
```

Open `http://127.0.0.1:6080/vnc.html` in your local browser. Authenticate Discord
yourself, navigate to MuggZone Options, and leave exactly one tab at that channel.
VNC/noVNC and Chrome debugging listen on cloud loopback only. Do not expose ports
5900, 6080 or 9222 directly. The browser sandbox remains enabled; if Chromium fails
because a container forbids its sandbox, use a compatible runtime or desktop VM.

## Configure and run

In a separate SSH shell, copy `/opt/muggzone/config/muggzone.example.json` to
`/workspace/muggzone-data/observer/config.json`. Replace the server ID, channel ID,
and MuggZone author ID(s). Discord Developer Mode → Copy Channel/User ID provides
these stable IDs manually. Display names are never treated as identity.

```sh
node /opt/muggzone/scripts/muggzone-observe.js --config /workspace/muggzone-data/observer/config.json --once
/opt/muggzone/deploy/muggzone/start-observer.sh /workspace/muggzone-data/observer/config.json
```

The first successful snapshot establishes a historical baseline without applying old
posts as fresh instructions. Subsequent polls run every four minutes, Monday–Friday,
08:00 inclusive to 17:00 exclusive in America/New_York, with DST handled by Intl.
Add explicit YYYY-MM-DD closure dates in `schedule.closed_dates`; this is a configured
weekday window, not an exchange holiday calendar. An off-hours `--once` reports
`outside_window` without connecting to Chrome. Stopping polling does not stop cloud
billing; instance start/stop scheduling is a separate hosting step.

The background launcher survives closing the SSH tunnel; check
`observer-status.json` and `observer-run.log` for the actual result. It runs until
stopped, the pod stops, or a required review halts it. Relaunch after a pod restart.
To stop it cleanly, send SIGTERM to the PID in `observer.lock` after verifying that
PID is the observer. A halted observer requires manual review before relaunch.

Use `--status` to inspect the ledger without connecting to Chrome. Keep both the
ledger and observer checkpoint together across restarts. Raw observations and the
SQLite shadow ledger live under `/workspace/muggzone-data/observer`; the authenticated
browser profile lives under `/workspace/muggzone-data/chrome-profile`. Protect and
back up that directory as account-sensitive data, and keep it outside source control.

## Halts and continuity

Each poll scrolls to the newest rendered messages, then scans backward through
overlapping windows until a previous message-ID anchor is found. New final-tail
content must overlap the original tail too. Missing anchors, nonoverlapping windows,
unresolved DOM authors, image-only messages, or unverified text halt the ledger for
review rather than silently skipping content. A changed raw body is preserved as an
edit even if Discord does not expose an edit timestamp. Reply IDs are used only when
the rendered reply DOM supplies a stable target; missing reply IDs are not invented.

Login, captcha, wrong-channel and unavailable-content states halt the observer.
Resolve authentication manually. A history gap or missing checkpoint/database pair
requires reconciliation, not deleting the files or automatically replacing the
baseline. A trade-related parse, edit, or linking review persists a source hold and
stops the CLI even when browser continuity is healthy. A restart does not clear it.
There is no automatic reconciliation command in this slice; inspect and resolve the
source evidence before adding one. There is no broker adapter and no order placement
in this image.

The DOM extractor is conservative and must be verified against the authenticated
channel during the first cloud run; Discord can change its rendered structure. In
particular, grouped messages without exposed author identity will stop for review.
