#!/usr/bin/env bash
set -euo pipefail
data_root="${MUGGZONE_DATA_ROOT:-/workspace/muggzone-data}"
if [[ "$data_root" != /* || "$data_root" == "/" || "$data_root" == "/opt/muggzone"* ]]; then
  echo "MUGGZONE_DATA_ROOT must be an absolute persistent directory outside the source tree" >&2
  exit 1
fi
if [[ ! "${SSH_PUBLIC_KEY:-}" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-nistp256)\  ]]; then
  echo "Set SSH_PUBLIC_KEY to your public SSH key; password login is disabled" >&2
  exit 1
fi
umask 077
mkdir -p "$data_root/chrome-profile" "$data_root/observer" "$data_root/ssh-host-keys" /home/trader/.ssh /run/sshd
chown trader:trader "$data_root"
chown -R trader:trader "$data_root/chrome-profile" "$data_root/observer" /home/trader/.ssh
chmod 700 "$data_root" "$data_root/chrome-profile" "$data_root/observer" "$data_root/ssh-host-keys" /home/trader/.ssh
# The public key is intentionally the only authentication material accepted by startup.
printf '%s\n' "$SSH_PUBLIC_KEY" > /home/trader/.ssh/authorized_keys
chown trader:trader /home/trader/.ssh/authorized_keys
chmod 600 /home/trader/.ssh/authorized_keys
if [[ ! -f "$data_root/ssh-host-keys/ssh_host_ed25519_key" ]]; then
  ssh-keygen -q -t ed25519 -N '' -f "$data_root/ssh-host-keys/ssh_host_ed25519_key"
fi
cat > /run/muggzone-sshd.conf <<EOF
Port 22
ListenAddress 0.0.0.0
HostKey $data_root/ssh-host-keys/ssh_host_ed25519_key
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
PermitRootLogin no
AllowUsers trader
AllowTcpForwarding local
GatewayPorts no
PermitTunnel no
X11Forwarding no
UsePAM no
PrintMotd no
Subsystem sftp internal-sftp
EOF
# Public HTTP/CDP/VNC endpoints are deliberately absent; reach the desktop through SSH.
runuser -u trader -- env DISPLAY="${DISPLAY:-:99}" MUGGZONE_DATA_ROOT="$data_root" \
  MUGGZONE_CHANNEL_URL="${MUGGZONE_CHANNEL_URL:-https://discord.com/login}" \
  /opt/muggzone/deploy/muggzone/start-desktop.sh &
desktop_pid=$!
/usr/sbin/sshd -D -e -f /run/muggzone-sshd.conf &
ssh_pid=$!
trap 'kill "$desktop_pid" "$ssh_pid" 2>/dev/null || true' EXIT INT TERM
wait -n "$desktop_pid" "$ssh_pid"
