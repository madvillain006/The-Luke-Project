import pyautogui
import base64
import io
import sys
import time
from PIL import Image

def take_screenshot():
    screenshot = pyautogui.screenshot()
    buffer = io.BytesIO()
    screenshot.save(buffer, format="PNG")
    buffer.seek(0)
    img_base64 = base64.b64encode(buffer.read()).decode("utf-8")
    return img_base64

def click(x, y):
    pyautogui.click(x, y)
    return f"Clicked at {x}, {y}"

def type_text(text):
    pyautogui.typewrite(text, interval=0.05)
    return f"Typed: {text}"

def open_url(url):
    import webbrowser
    pyautogui.hotkey('ctrl', 'w')
    time.sleep(0.5)
    webbrowser.open(url)
    time.sleep(4)
    return f"Opened URL: {url}"

def open_app(app_name):
    pyautogui.hotkey('win')
    time.sleep(1)
    pyautogui.typewrite(app_name, interval=0.05)
    time.sleep(1)
    pyautogui.press('enter')
    time.sleep(2)
    return f"Opened: {app_name}"

def scroll(direction, amount=10):
    if direction == "up":
        pyautogui.scroll(int(amount))
    else:
        pyautogui.scroll(-int(amount))
    return f"Scrolled {direction}"

def press_key(key):
    pyautogui.press(key)
    return f"Pressed: {key}"

def hotkey(*keys):
    pyautogui.hotkey(*keys)
    return f"Hotkey: {'+'.join(keys)}"

def get_screen_size():
    size = pyautogui.size()
    return f"{size.width},{size.height}"

if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else "screenshot"

    if command == "screenshot":
        print(take_screenshot())
    elif command == "open" and len(sys.argv) > 2:
        arg = sys.argv[2]
        if arg.startswith("http://") or arg.startswith("https://"):
            print(open_url(arg))
        else:
            print(open_app(arg))
    elif command == "click" and len(sys.argv) > 3:
        print(click(int(sys.argv[2]), int(sys.argv[3])))
    elif command == "type" and len(sys.argv) > 2:
        print(type_text(sys.argv[2]))
    elif command == "scroll" and len(sys.argv) > 2:
        amount = int(sys.argv[3]) if len(sys.argv) > 3 else 10
        print(scroll(sys.argv[2], amount))
    elif command == "press" and len(sys.argv) > 2:
        print(press_key(sys.argv[2]))
    elif command == "hotkey" and len(sys.argv) > 2:
        print(hotkey(*sys.argv[2:]))
    elif command == "size":
        print(get_screen_size())
    else:
        print(f"Unknown command: {command}")