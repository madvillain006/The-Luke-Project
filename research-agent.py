import asyncio
import json
import requests
from datetime import datetime
from playwright.async_api import async_playwright

LUKE_URL = "http://localhost:3000"
MEMORY_FILE = "memory.json"

def load_memory():
    try:
        with open(MEMORY_FILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError as e:
        print(f"[load_memory] corrupt memory.json: {e}")
        return {}

def save_memory(mem):
    with open(MEMORY_FILE, "w") as f:
        json.dump(mem, f, indent=2)

def notify(message):
    try:
        requests.post(f"{LUKE_URL}/notify", json={"message": message}, timeout=5)
    except (requests.ConnectionError, requests.Timeout) as e:
        print(f"[notify] Luke unreachable: {e}")

def analyze_article(text, url):
    try:
        res = requests.post(
            f"{LUKE_URL}/chat",
            json={
                "message": f"""You are Agent 06 — research agent. Read this article about AI agents and extract what is directly useful for building Luke.

URL: {url}

CONTENT:
{text[:3000]}

Extract:
1. KEY INSIGHT (one sentence — the most actionable thing)
2. APPLIES TO (which Luke agent this helps: scaffold/trader/research/all)
3. IMPLEMENTATION NOTE (one sentence on how to actually use this)
4. PRIORITY: HIGH / MEDIUM / LOW for Conor's current build stage

Be extremely concise. This feeds directly into memory.json.""",
                "history": []
            },
            timeout=30
        )
        return res.json().get("reply", "")
    except Exception as e:
        return f"Analysis failed: {e}"

async def scrape_bookmarks():
    print("Agent 06 starting — connecting to Chrome...")
    notify("Agent 06 online. Reading X bookmarks.")

    insights = []

    async with async_playwright() as p:
        browser = await p.chromium.connect_over_cdp("http://localhost:9222")
        context = browser.contexts[0]
        existing_pages = context.pages
        page = existing_pages[0] if existing_pages else await context.new_page()

        print("Navigating to X bookmarks...")
        try:
            await page.goto("https://x.com/i/bookmarks", wait_until="domcontentloaded", timeout=20000)
        except Exception as e:
            print(f"Navigation warning: {e}")
        await asyncio.sleep(4)

        current_url = page.url
        print(f"Current URL: {current_url}")
        if "login" in current_url or "signin" in current_url:
            print("Hit login wall.")
            notify("Agent 06 error: X not logged in.")
            return

        print("Scrolling to load bookmarks...")
        for _ in range(3):
            await page.keyboard.press("End")
            await asyncio.sleep(1.5)

        print("Collecting t.co links...")
        tco_links = await page.evaluate("""() => {
            const anchors = Array.from(document.querySelectorAll('a[href*="t.co"]'));
            return [...new Set(anchors.map(a => a.href))].slice(0, 25);
        }""")

        print(f"Found {len(tco_links)} t.co links. Expanding...")

        expanded = []
        for tco in tco_links:
            try:
                r = requests.head(tco, allow_redirects=True, timeout=5)
                final = r.url
                if "x.com" not in final and "twitter.com" not in final:
                    expanded.append(final)
            except:
                pass

        print(f"{len(expanded)} external article links found.")

        ai_keywords = [
            'agent', 'llm', 'prompt', 'memory', 'embedding', 'rag',
            'fine-tun', 'context', 'claude', 'gpt', 'model', 'inference',
            'langchain', 'autonomous', 'workflow', 'orchestrat', 'agentic',
            'multi-agent', 'tool use', 'function call', 'retrieval', 'vector'
        ]

        processed = 0
        for url in expanded:
            if processed >= 10:
                break
            try:
                print(f"Reading: {url[:70]}...")
                try:
                    await page.goto(url, wait_until="domcontentloaded", timeout=15000)
                except Exception:
                    pass
                await asyncio.sleep(2)

                text = await page.evaluate("""() => {
                    const selectors = ['article', 'main', '.post-content', '.article-body', '.content', 'body'];
                    for (const sel of selectors) {
                        const el = document.querySelector(sel);
                        if (el && el.innerText.length > 300) {
                            return el.innerText.slice(0, 4000);
                        }
                    }
                    return document.body.innerText.slice(0, 4000);
                }""")

                if len(text) < 300:
                    print("  Too short, skipping.")
                    continue

                if not any(kw in text.lower() for kw in ai_keywords):
                    print("  Not AI-related, skipping.")
                    continue

                print("  Analyzing...")
                insight = analyze_article(text, url)
                if insight and "failed" not in insight.lower():
                    insights.append({
                        "url": url,
                        "insight": insight,
                        "date": datetime.now().isoformat()
                    })
                    print("  Captured.")
                    processed += 1

                await asyncio.sleep(2)

            except Exception as e:
                print(f"  Error: {e}")
                continue

    if insights:
        mem = load_memory()
        if "agent06_research" not in mem:
            mem["agent06_research"] = []
        mem["agent06_research"].extend(insights)
        mem["agent06_last_run"] = datetime.now().isoformat()
        save_memory(mem)
        summary = f"Agent 06 complete. {len(insights)} insights saved to memory."
        print(summary)
        notify(summary)
    else:
        msg = "Agent 06 complete. No AI-relevant articles found."
        print(msg)
        notify(msg)

if __name__ == "__main__":
    asyncio.run(scrape_bookmarks())