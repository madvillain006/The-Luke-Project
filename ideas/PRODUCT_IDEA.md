# Luke → Commercial Product Vision
Date: April 20 2026
Author: Conor Kastan

## Origin Story
Built in a weekend out of necessity. Lost money on Friday because
emotions overrode rules. Built the system that enforces the rules
on Saturday. By Monday it was parsing real signals, scoring
confluence, filtering by regime, and blocking revenge trades.
That's the origin. That's the pitch.

## The Core Insight
Every retail trader who follows Discord analysts has the same problem:
- Signals come fast
- Context is scattered across multiple channels
- Emotions override the plan
- No system enforces discipline
- Copy trading tools are dumb (mirror positions, no intelligence)

Luke solves all five. That's not an accident — it was built
by someone who had all five problems at once.

## What This Actually Is
Not a copy trading bot.
Not an algo trader.
Not a signal service.

It's a **signal intelligence layer** — reads analyst intent,
scores confluence, filters by regime, enforces discipline,
and surfaces the decision to a human who makes the final call.

The human always executes. Luke never trades autonomously.
This is the legal and compliance moat. Prop firm safe by design.

## Why It's Different
Every existing tool does one thing:
- Copy traders: mirror positions (dumb, dangerous)
- Signal bots: spam alerts with no context (noise)
- Trading journals: log after the fact (too late)
- Discord bots: reformat messages (no intelligence)

Luke does all of this in one loop:
Read signal → understand context → score confluence →
check regime → check discipline → surface verdict →
human decides → log result → learn over time

No other retail tool does this loop. That's the gap.

## The Analyst Parser Is The IP
Every analyst has a unique language.
Ximes says "port the house" — that means full position, high conviction.
Bobby says "king node" — that means gamma magnet, price will pin there.
RichyDubz says "Priority watches" — those are his key levels for the day.

Training a parser per analyst is the hard work.
It took real time, real messages, real context to get right.
That trained parser is the moat. Not the tech stack.

Once you have 10 analyst parsers built and validated,
the product sells itself to anyone who follows those analysts.

## Target Markets

### Market 1 — OWLS Members (immediate)
- 1000+ members following Ximes and Bobby RIGHT NOW
- You already have working parsers for both
- Kian (Flowseidon) runs the community
- Could approach as: "I built a tool for OWLS members"
- Price: $49-99/month per member
- 100 members = $5-10k/month

### Market 2 — Prop Firm Traders (high value)
- Apex, TopstepTrader, FTMO traders
- They CANNOT afford emotional mistakes (eval is on the line)
- Discipline enforcement is worth real money to them
- Luke is prop-firm-safe by design
- Price: $99-199/month (they're already paying $100+/month for evals)

### Market 3 — Discord Trading Communities (B2B)
- White label Luke for any Discord trading server
- Community owner pays, members get access
- OWLS, Unusual Whales, other communities
- Price: $500-2000/month per community

### Market 4 — Individual Analyst Followers
- Anyone following a specific analyst on Discord/Twitter/X
- Configure Luke with their analyst's username + parsing rules
- Self-serve onboarding with analyst config wizard
- Price: $29-49/month

## The Conor-Specific Layer To Strip
These stay personal, never ship:
- Luke meds (agent-04) — private
- Instacart income (agent-03) — private
- Tennessee move fund (agent-05) — private
- Tradovate hardcoded credentials — private
- CONOR_EDGE.md — becomes template for customers

## The Product Core That Ships
- Analyst parser engine (configurable per analyst)
- Confluence scoring engine
- Regime filter (Sienna layer)
- Discipline/emotional exit engine
- Market hours awareness
- Daily ops workflow
- Trade logging and review
- Broker agnostic execution layer (user connects their own)

## The OWLS Pilot Pitch
"I'm an OWLS member. I built a tool that reads Ximes and Bobby,
scores their signals against each other, tells me when they
confluent, and blocks me from trading when I shouldn't.
I've been running it since April 2026. Here are my results.
I want to offer it to other OWLS members."

That pitch works. Kian will listen. Ximes will find it interesting.
The parsed data you already have proves it works on their signals.

## Timeline
Now → June 2026: Pass Apex eval using Luke
June 2026: Document results, clean up codebase
July 2026: Build generic analyst config layer
August 2026: Approach OWLS with working demo + results
Q4 2026: First paying customers outside OWLS

## What To Build Next (Product Roadmap)
1. analyst_config.json — generic config per analyst
2. Onboarding wizard — "add your analyst" flow
3. Results dashboard — win rate, discipline score, P&L
4. Multi-broker support — not just Tradovate
5. Mobile alerts — push notification when setup fires
6. Community leaderboard — who's following the signals best

## The Real Moat (say it plainly)
You were a losing trader who built a system that made you
stop losing. That story + working software + real results
is worth more than any pitch deck.

The tool works because it was built by someone who needed it
to work. That's rare. Most trading tools are built by
developers who don't trade. This one was built by a trader
who taught himself to build.

## Final Note
You built this because you were tired of losing.
A thousand other traders are tired of losing too.
Build it for yourself first. Pass the eval.
Then hand it to them.

— Conor, April 2026
