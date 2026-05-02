import subprocess
import time
import os
import sys
import ctypes

DRY_RUN = os.environ.get("LAYOUT_DRYRUN", "0") == "1"

import win32gui
import win32con
import win32api

# ── SCREEN DIMENSIONS ─────────────────────────────────────────────────────────
ctypes.windll.user32.SetProcessDPIAware()
monitor = win32api.GetMonitorInfo(win32api.MonitorFromPoint((0, 0)))
work    = monitor['Work']  # (left, top, right, bottom) — excludes taskbar
WW = work[2] - work[0]
WH = work[3] - work[1]
OX = work[0]
OY = work[1]
print(f"Workarea: {WW}x{WH} at ({OX},{OY})")

HW = WW // 2
HH = WH // 2

# Quadrant layout
LAYOUT = {
    "ximes":     (OX,      OY,      HW, HH),
    "bobby":     (OX + HW, OY,      HW, HH),
    "tradovate": (OX,      OY + HH, HW, HH),
    "luke":      (OX + HW, OY + HH, HW, HH),
}

# ── EDGE ──────────────────────────────────────────────────────────────────────
EDGE_PATHS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]
EDGE = next((p for p in EDGE_PATHS if os.path.exists(p)), None)
if not EDGE:
    print("ERROR: Edge not found")
    sys.exit(1)

GUILD         = "718624848812834903"
XIMES_URL     = f"https://discord.com/channels/{GUILD}/1476605105263612097"
BOBBY_URL     = f"https://discord.com/channels/{GUILD}/1473072016637821168"
TRADOVATE_URL = "https://trader.tradovate.com"

# ── HELPERS ───────────────────────────────────────────────────────────────────
def find_windows(fragment):
    result = []
    def cb(hwnd, _):
        title = win32gui.GetWindowText(hwnd)
        if win32gui.IsWindowVisible(hwnd) and fragment.lower() in title.lower():
            result.append(hwnd)
    win32gui.EnumWindows(cb, None)
    return result


def find_windows_exact(title_text):
    result = []
    def cb(hwnd, _):
        title = win32gui.GetWindowText(hwnd).strip()
        if win32gui.IsWindowVisible(hwnd) and title == title_text:
            result.append(hwnd)
    win32gui.EnumWindows(cb, None)
    return result

def move_win(hwnd, x, y, w, h, topmost=False):
    win32gui.ShowWindow(hwnd, win32con.SW_RESTORE)
    z = win32con.HWND_TOPMOST if topmost else win32con.HWND_NOTOPMOST
    win32gui.SetWindowPos(hwnd, z, x, y, w, h, win32con.SWP_SHOWWINDOW)

if DRY_RUN:
    for name, pos in LAYOUT.items():
        print(f"[DRY] {name}: {pos}")
    sys.exit(0)


def launch_luke():
    launcher = os.path.join(os.path.dirname(__file__), 'windows', 'LAUNCH-LUKE.cmd')
    electron = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'electron', 'dist', 'electron.exe')
    entry = os.path.join(os.path.dirname(__file__), '..', 'electron.js')
    if os.path.exists(launcher):
        print('Launching Luke via LAUNCH-LUKE.cmd...')
        subprocess.Popen(['cmd', '/c', launcher])
        return True
    if os.path.exists(electron) and os.path.exists(entry):
        print('Launching Luke via electron.exe...')
        subprocess.Popen([electron, entry], cwd=os.path.dirname(entry))
        return True
    print('Luke launcher not found')
    return False

# ── OPEN WINDOWS ──────────────────────────────────────────────────────────────
before = set(h for h in find_windows("Edge") + find_windows("Microsoft Edge"))

urls  = [XIMES_URL, BOBBY_URL, TRADOVATE_URL]
names = ["ximes", "bobby", "tradovate"]

print("Opening Edge windows...")
for i, url in enumerate(urls):
    subprocess.Popen([EDGE, "--new-window", "--profile-directory=Default", url])
    print(f"  Launched {names[i]}")
    time.sleep(4)

print("Waiting for windows to settle...")
time.sleep(5)

after   = set(h for h in find_windows("Edge") + find_windows("Microsoft Edge"))
new_wins = list(after - before)
print(f"  Found {len(new_wins)} new Edge windows")

# Position new Edge windows
order = [LAYOUT["ximes"], LAYOUT["bobby"], LAYOUT["tradovate"]]
for i, hwnd in enumerate(new_wins[:3]):
    x, y, w, h = order[i]
    move_win(hwnd, x, y, w, h)
    print(f"  Edge window {i+1} -> ({x},{y}) {w}x{h}")

# ── POSITION LUKE ─────────────────────────────────────────────────────────────
print("Positioning Luke...")
time.sleep(2)
luke = find_windows_exact("Luke")
if not luke:
    launched = launch_luke()
    if launched:
        for _ in range(12):
            time.sleep(1)
            luke = find_windows_exact("Luke")
            if luke:
                break
if luke:
    x, y, w, h = LAYOUT["luke"]
    move_win(luke[0], x, y, w, h, topmost=True)
    print(f"  Luke -> ({x},{y}) {w}x{h} topmost")
else:
    print("  Luke window not found")

print("\n[ok] Done.")
for name, pos in LAYOUT.items():
    print(f"  {name}: {pos}")
