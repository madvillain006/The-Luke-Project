#!/usr/bin/env python3
"""Run with /usr/local/bin/python, detached; preserves the running gateway token."""
import json
import os
import signal
import subprocess
import time
from pathlib import Path
from jupyter_server.serverapp import list_running_servers

servers = [s for s in list_running_servers() if s.get("port") == 8888]
if len(servers) != 1 or not servers[0].get("token"):
    raise SystemExit("Expected one authenticated Jupyter gateway on port 8888")
old = servers[0]
pod_id = os.environ.get("RUNPOD_POD_ID")
if not pod_id or not pod_id.isalnum():
    raise SystemExit("Missing valid RUNPOD_POD_ID")
config = Path("/tmp/muggzone-jupyter.json")
config.write_text(json.dumps({
    "IdentityProvider": {"token": old["token"]},
    "ServerApp": {"ip": "0.0.0.0", "port": 8888, "port_retries": 0,
                  "allow_root": True, "open_browser": False, "root_dir": "/workspace",
                  "base_url": old.get("base_url", "/"),
                  "allow_origin": f"https://{pod_id}-8888.proxy.runpod.net",
                  "jpserver_extensions": {"jupyter_server_proxy": True}},
}))
config.chmod(0o600)
os.kill(old["pid"], signal.SIGTERM)
time.sleep(3)
with open("/workspace/muggzone-runtime/jupyter-service.log", "ab") as log:
    subprocess.Popen(["/usr/local/bin/python", "-m", "jupyterlab", f"--config={config}"],
                     stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
print("Authenticated Jupyter desktop proxy started")
