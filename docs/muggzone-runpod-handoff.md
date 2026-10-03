# MuggZone cloud desktop handoff

Dedicated Secure Cloud pod: `tlp-muggzone-shadow-v1` (`mcpw0w6xqga9m1`). The temporary A40 costs $0.49/hour; it is not the planned $33–54/month host. Revisit CPU/cheaper capacity and scheduling after sign-in verification. Other pods are untouched.

The encrypted 10GB persistent volume holds `/workspace/muggzone-data` (browser profile, observer configuration, ledger) and `/workspace/muggzone-runtime`. It persists when the pod is stopped, but terminating the pod deletes its volume. This volume does not implement POSIX ownership/mode enforcement. Authentication at the Jupyter gateway is required; desktop ports 5900/6080 remain loopback only. Never expose these ports directly.

The actual Ubuntu 24.04 RunPod container cannot run Chromium's namespace sandbox. Firefox 148.0.2 from pinned Playwright 1.59.1 runs with its sandbox enabled. `scripts/muggzone-desktop.js` owns its persistent context and lends it to the same observer, so no separate browser or Discord token extraction is needed. Closing the observer attachment leaves the user's browser open. The desktop waits for an exact channel and author configuration before observing anything.

After manually signing into Discord, open MuggZone Options. Verify actual DOM metadata and scrolling, bind the exact channel and allowed author IDs, establish a historical baseline, and verify a duplicate poll before enabling the 240-second market-window loop. Live channel observation has not yet been validated. No broker adapter or live orders exist.

Bootstrap on the official PyTorch Ubuntu 24.04 template using `deploy/muggzone/setup-runpod.sh` with `MUGGZONE_REVISION` set to the reviewed commit SHA. Run the gateway helper detached with `/usr/local/bin/python deploy/muggzone/restart-jupyter-proxy.py`; it retains the existing token and enables only the exact pod origin. The noVNC route must include `?path=proxy%2F6080%2Fwebsockify` under the authenticated `/proxy/6080/vnc.html` page. Launch the desktop with `setsid runuser -u trader -- bash deploy/muggzone/start-firefox-desktop.sh` so terminal closure does not kill it.

Container packages do not survive pod stop/start; bootstrap and gateway recovery currently require rerunning these commands. Browser data lives on the volume. Automatic reboot recovery and cost-aware scheduling remain unfinished; do not represent this setup as unattended production.
