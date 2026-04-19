import asyncio
import base64
import requests
import json
from datetime import datetime
from playwright.async_api import async_playwright

JARVIS_URL = "http://localhost:3000"

CHANNELS = [
    {"server": "Base", "name": "positions", "url": "https://discord.com/channels/995345482618503249/995347068942045204", "priority": "HIGH"},
    {"server": "Base", "name": "spx-ndx-futures", "url": "https://discord.com/channels/995345482618503249/1304107087193702511", "priority": "HIGH"},
    {"server": "Base", "name": "flow", "url": "https://discord.com/channels/995345482618503249/995345863050268803", "priority": "HIGH"},
    {"server": "Elevated Charts", "name": "jefe-flow", "url": "https://discord.com/channels/755261229748191313/1443678893377851586", "priority": "HIGH"},
    {"server": "Elevated Charts", "name": "uw-flow", "url": "https://discord.com/channels/755261229748191313/1389824176881270808", "priority": "MEDIUM"},
    {"server": "Elevated Charts", "name": "trade-floor", "url": "https://discord.com/channels/755261229748191313/1040400353490911292", "priority": "MEDIUM"},
    {"server": "OWLS Capital", "name": "trading-floor", "url": "https://discord.com/channels/718624848812834903/718643687097368658", "priority": "HIGH"},
    {"server": "OWLS Capital", "name": "bobby-spx-coms", "url": "https://discord.com/channels/718624848812834903/1473072016637821168", "priority": "HIGH"},
    {"server": "OWLS Capital", "name": "giul-heatseeker", "url": "https://discord.com/channels/718624848812834903/1457591894337916999", "priority": "MEDIUM"},
    {"server": "OWLS Capital", "name": "ximes-dubz", "url": "https://discord.com/channels/718624848812834903/1476605105263612097", "priority": "MEDIUM"},
    {"server": "OWLS Capital", "name": "news", "url": "https://discord.com/channels/718624848812834903/1081082844807434292", "priority": "LOW"},
    {"server": "DM", "name": "GOATS", "url": "https://discord.com/channels/@me/1319318159328809070", "priority": "HIGH"},
    {"server": "DM", "name": "Flow", "url": "https://discord.com/channels/@me/1417517605576638484", "priority": "HIGH"},
    {"server": "DM", "name": "OWLS ALERTS", "url": "https://discord.com/channels/@me/1450560212900647016", "priority": "HIGH"},
    {"server": "DM", "name": "bigT", "url": "https://discord.com/channels/@me/963573643194015814", "priority": "MEDIUM"},
    {"server": "DM", "name": "BarrySenders329", "url": "https://discord.com/channels/@me/1137717841609629786", "priority": "MEDIUM"},
]

SCAN_PROMPT = """You are scanning a Discord trading channel for Conor, an options trader.

Look for:
- Trade entries, exits, or position updates
- Flow or unusual options activity  
- Specific tickers with strikes and expiry
- High conviction calls from traders
- Images showing flow or charts — describe what you see in them

Rate each item:
HIGH — specific trade with ticker, direction, entry. Act now.
MEDIUM — relevant setup or analysis worth knowing.
LOW — general commentary, not actionable.

If the last messages are more than 2 hours old, say: STALE
If nothing trading-related: NOTHING RELEVANT

Format — one line per item, max 5 items:
RATING | TRADER | SUMMARY"""

def notify(message):
    try:
        requests.post(f"{JARVIS_URL}/notify", json={"message": message}, timeout=5)
        print(f"Notified: {message[:80]}")
    except Exception as e:
        print(f"Notify failed: {e}")

async def scan_channel(page, channel):
    print(f"Scanning {channel['server']} / #{channel['name']}...")
    try:
        await page.goto(channel["url"], wait_until="networkidle", timeout=15000)
        await asyncio.sleep(3)

        text_content = await page.evaluate("""() => {
            const messages = document.querySelectorAll('[class*="messageContent"]');
            const usernames = document.querySelectorAll('[class*="username"]');
            let result = [];
            messages.forEach((msg, i) => {
                const user = usernames[i] ? usernames[i].innerText : 'unknown';
                result.push(user + ': ' + msg.innerText);
            });
            return result.slice(-30).join('\\n');
        }""")

        screenshot = await page.screenshot(type="png")
        img_base64 = base64.b64encode(screenshot).decode("utf-8")

        payload = {
            "question": f"Channel: {channel['server']} #{channel['name']}\n\nRecent messages:\n{text_content}\n\n{SCAN_PROMPT}"
        }

        res = requests.post(f"{JARVIS_URL}/see", json=payload, timeout=30)
        result = res.json().get("reply", "").strip()
        print(f"  → {result[:100]}")
        return result

    except Exception as e:
        print(f"  Scan failed: {e}")
        return "ERROR"

async def run_scan():
    print(f"\n=== SCAN {datetime.now().strftime('%H:%M')} ===")
    high_alerts = []
    medium_alerts = []

    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9222")
        context = browser.contexts[0]
        page = await context.new_page()

        for channel in CHANNELS:
            result = await scan_channel(page, channel)

            if any(x in result.upper() for x in ["NOTHING RELEVANT", "STALE", "ERROR"]):
                continue

            for line in result.strip().split("\n"):
                line = line.strip()
                if not line:
                    continue
                tag = f"[{channel['server']} #{channel['name']}] {line}"
                if line.startswith("HIGH"):
                    high_alerts.append(tag)
                elif line.startswith("MEDIUM"):
                    medium_alerts.append(tag)

            await asyncio.sleep(1)

        await page.close()

    if high_alerts:
        notify("🔴 HIGH:\n" + "\n".join(high_alerts))
    if medium_alerts:
        notify("🟡 MEDIUM:\n" + "\n".join(medium_alerts))
    if not high_alerts and not medium_alerts:
        print("Nothing actionable.")

    print(f"=== END {datetime.now().strftime('%H:%M')} ===\n")

async def run_monitor(interval_minutes=15):
    print(f"Monitor active. {len(CHANNELS)} channels. Every {interval_minutes} min.")
    notify("Jarvis monitor online.")
    while True:
        try:
            await run_scan()
        except Exception as e:
            print(f"Monitor error: {e}")
        await asyncio.sleep(interval_minutes * 60)

if __name__ == "__main__":
    asyncio.run(run_monitor(interval_minutes=15))