import subprocess
import time
import os
import sys

DRY_RUN = os.environ.get("LAYOUT_DRYRUN", "0") == "1"

# RAM check — skip in dry-run since no windows are opened
if not DRY_RUN:
    try:
        import ctypes
        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]
        stat = MEMORYSTATUSEX()
        stat.dwLength = ctypes.sizeof(stat)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
        avail_gb = stat.ullAvailPhys / (1024 ** 3)
        if avail_gb < 2.0:
            print(f"WARNING: Only {avail_gb:.1f} GB RAM available (< 2 GB). Aborting to prevent crash.")
            sys.exit(1)
        print(f"RAM check: {avail_gb:.1f} GB available — ok")
    except Exception as e:
        print(f"RAM check skipped (could not read): {e}")

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

XIMES_URL     = f"https://discord.com/channels/{GUILD}/{XIMES_CHANNEL}"
BOBBY_URL     = f"https://discord.com/channels/{GUILD}/{BOBBY_CHANNEL}"
TRADOVATE_URL = "https://trader.tradovate.com"

windows = [
    {"url": XIMES_URL,     "x": 0,   "y": 0,   "w": 960, "h": 540, "name": "ximes-dubz"},
    {"url": BOBBY_URL,     "x": 0,   "y": 540, "w": 960, "h": 540, "name": "bobby-spx"},
    {"url": TRADOVATE_URL, "x": 960, "y": 0,   "w": 960, "h": 540, "name": "tradovate"},
]

JARVIS_POS = {"x": 960, "y": 540, "w": 400, "h": 540}

def find_window(fragment):
    result = []
    def cb(hwnd, _):
        if win32gui.IsWindowVisible(hwnd):
            title = win32gui.GetWindowText(hwnd)
            if fragment.lower() in title.lower():
                result.append(hwnd)
    win32gui.EnumWindows(cb, None)
    return result[0] if result else None

if DRY_RUN:
    print("[DRY RUN] Would open 3 Edge windows:")
    for w in windows:
        print(f"  {w['name']}: {w['url']} at ({w['x']},{w['y']}) {w['w']}x{w['h']}")
    print(f"[DRY RUN] Would position Jarvis at ({JARVIS_POS['x']},{JARVIS_POS['y']}) {JARVIS_POS['w']}x{JARVIS_POS['h']} TOPMOST")
    print("[DRY RUN] No windows were moved or opened.")
    sys.exit(0)

print("Opening 3 Edge windows...")
for w in windows:
    subprocess.Popen([
        EDGE,
        "--new-window",
        "--profile-directory=Default",
        f"--window-position={w['x']},{w['y']}",
        f"--window-size={w['w']},{w['h']}",
        w["url"]
    ])
    time.sleep(5)
    print(f"  Opened {w['name']}")

print("Finding and positioning Jarvis...")
time.sleep(4)
jarvis_hwnd = find_window("Jarvis")
if jarvis_hwnd:
    win32gui.SetWindowPos(
        jarvis_hwnd, win32con.HWND_TOPMOST,
        JARVIS_POS["x"], JARVIS_POS["y"], JARVIS_POS["w"], JARVIS_POS["h"],
        win32con.SWP_SHOWWINDOW
    )
    print("  Jarvis pinned bottom-right always-on-top")
else:
    print("  Jarvis not found — launch it first, then re-run")

print("\n[ok] Layout complete.")
print("- ximes-dubz  top-left     (0,0)    960x540")
print("- bobby-spx   bottom-left  (0,540)  960x540")
print("- tradovate   top-right    (960,0)  960x540")
print("- jarvis      bottom-right (960,540) 400x540 topmost")
