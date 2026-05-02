# CONOR_RENAME_CHECKLIST.md
## Step 4 — Directory rename + post-rename config fixup

All in-repo renames are done and verified. This is the manual step to rename the
folder on disk and update the handful of hardcoded absolute paths that couldn't
be updated until the folder exists at the new location.

---

## PRE-FLIGHT

1. Stop all processes:
   ```
   pm2 delete all
   pm2 list   ← confirm empty
   ```

2. Close VS Code if it has `C:\Users\conor\jarvis` open.

3. Close any PowerShell / terminal windows sitting inside `C:\Users\conor\jarvis`.

---

## RENAME

4. In a **new** PowerShell window (NOT inside the jarvis folder), run:
   ```powershell
   Rename-Item "C:\Users\conor\jarvis" "C:\Users\conor\luke"
   ```

5. Verify:
   ```
   ls C:\Users\conor\luke\index.js   ← should exist
   ls C:\Users\conor\jarvis          ← should NOT exist
   ```

---

## POST-RENAME PATH FIXUP

Open VS Code in `C:\Users\conor\luke` and update these absolute paths:

### ecosystem.config.js (lines 6, 15, 24)
Change all three `cwd` lines from:
```
cwd: "C:\\Users\\conor\\jarvis",
```
to:
```
cwd: "C:\\Users\\conor\\luke",
```

### RESTART-LUKE.bat (line 2)
```
cd /d C:\Users\conor\luke
```

### START-LUKE.ps1 (line 1)
```
cd C:\Users\conor\luke
```

### .claude/settings.local.json
Update any path that references `C:\Users\conor\jarvis` → `C:\Users\conor\luke`.

### SWEEPER_MAP.json
Find/replace `C:\\Users\\conor\\jarvis` → `C:\\Users\\conor\\luke` (the `full` path fields).

### SWEEPER_STATE.json
Find/replace any absolute paths referencing old folder name.

### repo-map.json
The `root` field at line 2:
```json
"root": "C:\\Users\\conor\\luke",
```

### memory.json
Search for any occurrence of `C:\\Users\\conor\\jarvis` and update to `luke`.

---

## SMOKE TEST

6. Start Luke:
   ```
   cd C:\Users\conor\luke
   pm2 start ecosystem.config.js
   pm2 list
   ```
   Confirm: `luke-server` online, `luke-scheduler` online, `luke-intraday` stopped.

7. Hit the price endpoint:
   ```
   curl http://localhost:3000/price/spx
   ```
   Confirm: JSON with `"ticker":"SPX"` and a price number.

8. Open Electron / chat interface and verify title bar shows "Luke" (not "Jarvis").

---

## FINAL STEP — Git commit

After smoke tests pass, run the commit from `C:\Users\conor\luke`:

```
git add -A
git commit -m "Rename project: Jarvis → Luke, in memory of Luke"
```

Do NOT merge, push, or rename the GitHub remote without explicit instruction.

---

*Generated 2026-04-24 — rename/jarvis-to-luke branch*
