import subprocess
import time
import os
import sys
import win32gui
import win32con

EDGE_PATHS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
]
EDGE = next((p for p in EDGE_PATHS if os.path.exists(p)), None)
if not EDGE:
    print("ERROR: Edge not found")
    sys.exit(1)

GUILD = "718624848812834903"
XIMES_CHANNEL = "1476605105263612097"
BOBBY_CHANNEL = "1473072016637821168"

XIMES_URL = f"https://discord.com/channels/{GUILD}/{XIMES_CHANNEL}"
BOBBY_URL  = f"https://discord.com/channels/{GUILD}/{BOBBY_CHANNEL}"
TRADOVATE_URL = "https://trader.tradovate.com"

windows = [
    {"url": XIMES_URL,     "x": 0,   "y": 0,   "w": 960, "h": 540, "name": "ximes"},
    {"url": BOBBY_URL,     "x": 0,   "y": 540, "w": 960, "h": 540, "name": "bobby"},
    {"url": TRADOVATE_URL, "x": 960, "y": 0,   "w": 960, "h": 540, "name": "tradovate"},
]

def find_window(fragment):
    result = []
    def cb(hwnd, _):
        if win32gui.IsWindowVisible(hwnd):
            title = win32gui.GetWindowText(hwnd)
            if fragment.lower() in title.lower():
                result.append(hwnd)
    win32gui.EnumWindows(cb, None)
    return result[0] if result else None

print("Opening 3 Edge windows...")
for win in windows:
    subprocess.Popen([
        EDGE,
        f"--window-position={win['x']},{win['y']}",
        f"--window-size={win['w']},{win['h']}",
        "--new-window",
        win["url"]
    ])
    time.sleep(3)
    print(f"  Opened {win['name']}")

print("Finding and positioning Jarvis...")
time.sleep(2)
jarvis_hwnd = find_window("Jarvis")
if jarvis_hwnd:
    win32gui.SetWindowPos(
        jarvis_hwnd, win32con.HWND_TOPMOST,
        1340, 600, 400, 520,
        win32con.SWP_SHOWWINDOW
    )
    print("  Jarvis pinned bottom-right always-on-top")
else:
    print("  Jarvis not found — launch it first")

print("\n[ok] Layout complete.")
print("- ximes top-left")
print("- bobby bottom-left")
print("- tradovate top-right")
print("- jarvis bottom-right")
