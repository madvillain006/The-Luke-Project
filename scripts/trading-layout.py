import subprocess
import time
import sys
import os
import urllib.request
import json
import ctypes

import pyautogui

XIMES_URL = "https://discord.com/channels/718624848812834903/1476605105263612097"
BOBBY_URL = "https://discord.com/channels/718624848812834903/1473072016637821168"
TRADOVATE_URL = "https://trader.tradovate.com"

JARVIS_NOTIFY_URL = "http://localhost:3000/notify"

SW_RESTORE = 9
SW_SHOWMAXIMIZED = 3

def notify_jarvis(message):
    try:
        data = json.dumps({"message": message}).encode("utf-8")
        req = urllib.request.Request(
            JARVIS_NOTIFY_URL,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        urllib.request.urlopen(req, timeout=3)
    except Exception:
        pass

def open_chrome_url(url):
    subprocess.Popen(["start", "chrome", url], shell=True)
    time.sleep(3)

def scroll_discord_to_bottom():
    screen_w, screen_h = pyautogui.size()
    center_x = screen_w // 2
    center_y = screen_h // 2
    pyautogui.click(center_x, center_y)
    time.sleep(0.3)
    pyautogui.hotkey("ctrl", "end")
    time.sleep(0.5)

def position_window(hwnd, x, y, w, h):
    try:
        user32 = ctypes.windll.user32
        user32.ShowWindow(hwnd, SW_RESTORE)
        time.sleep(0.2)
        user32.MoveWindow(hwnd, x, y, w, h, True)
    except Exception:
        pass

def find_chrome_windows():
    import ctypes.wintypes
    results = []
    EnumWindows = ctypes.windll.user32.EnumWindows
    GetWindowText = ctypes.windll.user32.GetWindowTextW
    GetWindowTextLength = ctypes.windll.user32.GetWindowTextLengthW
    IsWindowVisible = ctypes.windll.user32.IsWindowVisible

    def callback(hwnd, _):
        if IsWindowVisible(hwnd):
            length = GetWindowTextLength(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                GetWindowText(hwnd, buf, length + 1)
                title = buf.value
                if "Chrome" in title or "Google" in title:
                    results.append((hwnd, title))
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)
    EnumWindows(WNDENUMPROC(callback), 0)
    return results

def find_window_by_title(partial):
    import ctypes.wintypes
    found = []
    EnumWindows = ctypes.windll.user32.EnumWindows
    GetWindowText = ctypes.windll.user32.GetWindowTextW
    GetWindowTextLength = ctypes.windll.user32.GetWindowTextLengthW
    IsWindowVisible = ctypes.windll.user32.IsWindowVisible

    def callback(hwnd, _):
        if IsWindowVisible(hwnd):
            length = GetWindowTextLength(hwnd)
            if length > 0:
                buf = ctypes.create_unicode_buffer(length + 1)
                GetWindowText(hwnd, buf, length + 1)
                if partial.lower() in buf.value.lower():
                    found.append(hwnd)
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.wintypes.HWND, ctypes.wintypes.LPARAM)
    EnumWindows(WNDENUMPROC(callback), 0)
    return found

def set_foreground(hwnd):
    try:
        ctypes.windll.user32.SetForegroundWindow(hwnd)
        time.sleep(0.3)
    except Exception:
        pass

def main():
    sw = pyautogui.size()
    half_w = sw.width // 2
    half_h = sw.height // 2

    print("📐 Layout starting...")

    # Step 1: Open Jarvis Electron — bottom-right
    print("1. Positioning Jarvis...")
    jarvis_wins = find_window_by_title("Jarvis")
    if jarvis_wins:
        position_window(jarvis_wins[0], half_w, half_h, half_w, half_h)
    else:
        subprocess.Popen(["npm", "run", "electron"], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__))), shell=True)
        time.sleep(3)
        jarvis_wins = find_window_by_title("Jarvis")
        if jarvis_wins:
            position_window(jarvis_wins[0], half_w, half_h, half_w, half_h)

    # Step 2: Open ximes-dubz Discord — top-left, scroll to bottom
    print("2. Opening ximes-dubz (scrolling to bottom)...")
    open_chrome_url(XIMES_URL)
    time.sleep(3)
    scroll_discord_to_bottom()
    chrome_wins = find_chrome_windows()
    if chrome_wins:
        position_window(chrome_wins[0][0], 0, 0, half_w, half_h)
        set_foreground(chrome_wins[0][0])
        time.sleep(0.3)
        scroll_discord_to_bottom()

    # Step 3: Open bobby-spx-coms Discord — bottom-left, scroll to bottom
    print("3. Opening bobby-spx-coms (scrolling to bottom)...")
    open_chrome_url(BOBBY_URL)
    time.sleep(3)
    scroll_discord_to_bottom()
    chrome_wins2 = find_chrome_windows()
    new_wins = [w for w in chrome_wins2 if w not in chrome_wins]
    if new_wins:
        position_window(new_wins[0][0], 0, half_h, half_w, half_h)
        set_foreground(new_wins[0][0])
        time.sleep(0.3)
        scroll_discord_to_bottom()

    # Step 4: Open Tradovate — top-right, check for login
    print("4. Opening Tradovate (checking login)...")
    open_chrome_url(TRADOVATE_URL)
    time.sleep(5)

    all_wins = find_chrome_windows()
    known = set(w[0] for w in (chrome_wins or []) + (new_wins or []))
    tradovate_wins = [w for w in all_wins if w[0] not in known]
    if tradovate_wins:
        position_window(tradovate_wins[0][0], half_w, 0, half_w, half_h)
        set_foreground(tradovate_wins[0][0])

    time.sleep(1)
    title_wins = find_window_by_title("Login") + find_window_by_title("Sign in") + find_window_by_title("tradovate")
    titles_text = " ".join(
        ctypes.create_unicode_buffer(512).value
        for _ in range(1)
    )

    import ctypes.wintypes
    detected_login = False
    for hwnd in find_window_by_title("Tradovate") + find_window_by_title("tradovate"):
        buf = ctypes.create_unicode_buffer(512)
        ctypes.windll.user32.GetWindowTextW(hwnd, buf, 512)
        t = buf.value.lower()
        if "login" in t or "sign in" in t or "sign-in" in t:
            detected_login = True
            break

    if not detected_login:
        # Take screenshot and check via title heuristic
        # Tradovate login page title is typically "Tradovate | Login" or similar
        for hwnd, title in find_chrome_windows():
            if "tradovate" in title.lower():
                if "login" in title.lower() or "sign" in title.lower():
                    detected_login = True
                    break

    if detected_login:
        print("⚠️ Tradovate login detected — notifying Jarvis...")
        notify_jarvis("⚠️ Tradovate needs login. Please sign in manually.")
    else:
        print("✅ Tradovate appears logged in (or page loading — verify manually)")

    # Step 5: Focus Jarvis last
    print("5. Focusing Jarvis...")
    final_jarvis = find_window_by_title("Jarvis")
    if final_jarvis:
        set_foreground(final_jarvis[0])
        position_window(final_jarvis[0], half_w, half_h, half_w, half_h)

    print("✅ Layout complete. Type /status when ready to trade.")

if __name__ == "__main__":
    main()
