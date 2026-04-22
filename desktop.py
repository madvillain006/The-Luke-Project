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

def get_mouse_pos():
    pos = pyautogui.position()
    return f"{pos.x},{pos.y}"

def wait_seconds(n):
    time.sleep(float(n))
    return f"Waited {n}s"

def find_text_click(text):
    try:
        import pytesseract
        import numpy as np
        screenshot = pyautogui.screenshot()
        data = pytesseract.image_to_data(screenshot, output_type=pytesseract.Output.DICT)
        for i, word in enumerate(data["text"]):
            if text.lower() in word.lower() and int(data["conf"][i]) > 50:
                x = data["left"][i] + data["width"][i] // 2
                y = data["top"][i] + data["height"][i] // 2
                pyautogui.click(x, y)
                return f"Found and clicked '{text}' at {x},{y}"
        return f"Text not found: {text}"
    except Exception as e:
        return f"Find failed: {e}"

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
    elif command == "mousepos":
        print(get_mouse_pos())
    elif command == "wait" and len(sys.argv) > 2:
        print(wait_seconds(sys.argv[2]))
    elif command == "find" and len(sys.argv) > 2:
        print(find_text_click(sys.argv[2]))
    else:
        print(f"Unknown command: {command}")