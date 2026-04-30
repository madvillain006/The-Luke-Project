CHECK 11: LUKE TRADING WORKFLOW — START TO FINISH
===================================================
Date: 2026-04-30

=== BEFORE MARKET (8:00-9:15 ET) ===

1. VERIFY LUKE IS RUNNING
   - Check pm2 list: luke-server and luke-scheduler must show "online"
   - Hit /health: confirm {"ok":true}
   - Send /status: must show "LUKE ONLINE"

2. UPDATE APEX BALANCE
   /balance <current_apex_balance>
   Example: /balance 50717
   → Sets trail floor automatically (balance - $2,500)
   → MUST be done fresh each session day

3. LOAD SATY ATR LEVELS (8:25-8:35 auto, or manual)
   Auto-pull fires between 8:25-8:35 ET from Polygon SPX data.
   If auto-pull fails or is stale: paste 13 levels from Saty's Discord manually.
   /saty <atr+1> <ext+4> <ext+3>...<atr-1>   (13 levels, highest to lowest)

4. LOAD RICHYDUBZ LEVELS
   Copy morning Dubz message from Discord. Paste it:
   /dubz [full message text here]
   → Extracts ES/NQ/SPY levels. Confirm level count is > 0.

5. LOAD BOBBY HEATMAP
   After Bobby posts heatmap image or text:
   /heatmap [paste heatmap text]
   Or paste image directly into chat (vision will parse it).

6. CONFIRM READY
   /ready
   → Must show all OK lines before trading.
   → "Apex floor safe" must show ✓ with meaningful headroom (>$500 minimum).

7. RUN /verdict TO SEE CONFLUENCE
   /verdict ES
   → Shows top-5 scored ES levels with grade, timing, sizing guidance.
   → Only actionable grades: A/B. Skip C/D unless nothing better exists.

=== AT SIGNAL (during RTH 9:30-4:00) ===

8. RECEIVE ALERT FROM CONFLUENCE / CHART READ
   /alert ES long <entry> <stop> <target>
   Example: /alert ES long 5801 5798 5815
   
   Luke evaluates:
   a. Market hours check (must be RTH, not lunch, not last 10 min)
   b. Parse signal: ticker, direction, entry, stop, target
   c. Confluence check: is there a level from Level Memory near entry?
   d. Bracket calc: risk/reward, R:R ratio, risk_dollars
   e. APEX FLOOR GUARD: (balance - risk_dollars - $200) <= trail_floor → BLOCK
   f. Verdict: SETUP (take it) or WEAK (R:R borderline) or SKIP

9. EXECUTE (MANUAL — Apex is not automated)
   If /alert returns SETUP:
   - Open Tradovate, enter the trade manually
   - Lane A (standard_3c): 3 contracts, stop as shown, target = first level above
   - Lane B (ATM 3pt): only if this level has been touched 3+ times today; 2 contracts, 3pt target

   MANUAL SAME-DAY CAP (no automation for this):
   If Lane A already LOST today:
     → Before taking Lane B, check: combined max loss on Lane B alone vs Apex headroom
     → On volatile days (like 04-07): combined Lane A + Lane B loss can exceed $2,000
     → Consider skipping Lane B or reducing to 1 contract on Lane B if Lane A lost

10. LOG TRADE RESULT
    /trade close <pts>  (when trade exits)
    Or let Luke track automatically if connected.

=== AFTER MARKET ===

11. UPDATE BALANCE
    /balance <end_of_day_balance>
    → Apex EOD trail floor recalculates

12. REVIEW SESSION
    /trades  → today's trade log
    /status  → final state

=== OPTIMAL STRATEGY REFERENCE ===
  Rank 1 (highest P&L): Standard 3c + ATM 3pt
    - Max Apex risk on bad open: -$2,225 (stop_first) — can breach on 04-07 type days
  Rank 2 (safest): ATM 2pt + ATM 3pt
    - Only fires on ATM machine days (tap 3+)
    - Zero drawdown in target_first backtest
  Rank 3 (simplest): ATM 3pt only
    - Clean, no combined-lane Apex risk
    
  See docs/OPTIMAL_STRATEGIES.md for full tables.

=== KEY FILES ===
  data/apex-state.json       — current balance & trail floor
  data/saty-levels.json      — today's Saty ATR levels
  data/dubz-levels.json      — today's Dubz levels
  data/level-memory.json     — multi-session canonical level scores
  data/saty-auto-pull.json   — Saty auto-pull state (last run timestamp)
  lib/slash-commands.js      — all slash command handlers
  trading/risk.js            — Apex floor guard, consistency cap functions
  lib/confluence-engine.js   — scoreLevel, buildVerdictMarkdown
  lib/bracket-calc.js        — R:R, risk_dollars (uses correct dpt values)
